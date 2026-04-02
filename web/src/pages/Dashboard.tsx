import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api/client.ts';
import { RiskBadge, RecBadge, eur } from '../components/Badge.tsx';

export default function Dashboard() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: api.dashboard });
  const { data: scrapeStatus } = useQuery({ queryKey: ['scrapeStatus'], queryFn: api.scrapeStatus, refetchInterval: 3000 });

  const scrape = useMutation({
    mutationFn: () => api.scrape(5),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scrapeStatus'] }),
  });
  const analyzeAll = useMutation({
    mutationFn: api.analyzeAll,
    onSuccess: () => setTimeout(() => qc.invalidateQueries({ queryKey: ['dashboard'] }), 2000),
  });

  if (isLoading) return <div className="text-gray-500 py-12 text-center">Loading...</div>;
  if (!data) return null;

  const { total, byStatus, hotDeals } = data;

  const statuses = ['new', 'analyzed', 'contacted', 'negotiating', 'rejected', 'bought'];
  const statusColors: Record<string, string> = {
    new: 'text-gray-300', analyzed: 'text-blue-400', contacted: 'text-yellow-400',
    negotiating: 'text-purple-400', rejected: 'text-red-400', bought: 'text-green-400',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <div className="flex gap-2">
          <button
            onClick={() => scrape.mutate()}
            disabled={scrape.isPending || scrapeStatus?.scraping}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-sm rounded transition-colors"
          >
            {scrapeStatus?.scraping ? '⏳ Scraping...' : '🔍 Scrape'}
          </button>
          <button
            onClick={() => analyzeAll.mutate()}
            disabled={analyzeAll.isPending}
            className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-sm rounded transition-colors"
          >
            {analyzeAll.isPending ? '⏳ Analyzing...' : '🤖 Analyze all'}
          </button>
        </div>
      </div>

      {analyzeAll.data && (
        <div className="bg-blue-950 border border-blue-800 rounded p-3 text-sm text-blue-300">
          Queued {analyzeAll.data.queued} listings for analysis — running in background.
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        <div className="col-span-3 sm:col-span-1 bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-3xl font-bold text-white">{total}</div>
          <div className="text-xs text-gray-500 mt-1">Total listings</div>
        </div>
        {statuses.map((s) => (
          <div key={s} className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className={`text-2xl font-bold ${statusColors[s]}`}>{byStatus[s] ?? 0}</div>
            <div className="text-xs text-gray-500 mt-1 capitalize">{s}</div>
          </div>
        ))}
      </div>

      {/* Hot Deals */}
      {hotDeals.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
            🔥 Hot Deals (risk ≤ 4, not yet contacted)
          </h2>
          <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-500 text-xs">
                  <th className="text-left px-4 py-2">ID</th>
                  <th className="text-left px-4 py-2">Car</th>
                  <th className="text-right px-4 py-2">Price</th>
                  <th className="text-right px-4 py-2">Offer</th>
                  <th className="text-center px-4 py-2">Risk</th>
                  <th className="text-left px-4 py-2">Rec</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {hotDeals.map((r) => (
                  <tr key={r.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 text-gray-500">#{r.id}</td>
                    <td className="px-4 py-3">
                      <div className="text-white font-medium">{r.title}</div>
                      <div className="text-xs text-gray-500">{r.year} · {r.mileage ? `${r.mileage.toLocaleString()} km` : '—'} · {r.district ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-white">{eur(r.price)}</td>
                    <td className="px-4 py-3 text-right text-green-400">{eur(r.suggestedOffer)}</td>
                    <td className="px-4 py-3 text-center"><RiskBadge score={r.riskScore} /></td>
                    <td className="px-4 py-3"><RecBadge rec={r.recommendation} /></td>
                    <td className="px-4 py-3">
                      <Link to={`/listings/${r.id}`} className="text-blue-400 hover:text-blue-300 text-xs">
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
