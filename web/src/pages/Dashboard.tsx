import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api/client.ts';
import { RiskBadge, RecBadge, eur } from '../components/Badge.tsx';
import { useToast } from '../components/Toast.tsx';

const HOT_PAGE_SIZE = 5;

export default function Dashboard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [hotPage, setHotPage] = useState(1);
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: api.dashboard });
  const { data: scrapeStatus } = useQuery({ queryKey: ['scrapeStatus'], queryFn: api.scrapeStatus, refetchInterval: 3000 });

  // Track previous status to detect completion
  const prevStatus = useRef<{ refreshing?: boolean; scraping?: boolean }>({});
  useEffect(() => {
    if (!scrapeStatus) return;
    const prev = prevStatus.current;

    if (prev.refreshing && !scrapeStatus.refreshing && scrapeStatus.lastRefreshResult) {
      const r = scrapeStatus.lastRefreshResult;
      toast(
        `Refresh done: ${r.checked} checked, ${r.expired} expired, ${r.priceChanged} price changes${r.errors > 0 ? `, ${r.errors} errors` : ''}`,
        r.errors > 0 ? 'error' : 'success',
        { duration: 6000 },
      );
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['listings'] });
    }

    if (prev.scraping && !scrapeStatus.scraping) {
      toast('Scrape finished', 'success', { duration: 5000 });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['listings'] });
    }

    prevStatus.current = { refreshing: scrapeStatus.refreshing, scraping: scrapeStatus.scraping };
  }, [scrapeStatus, toast, qc]);

  const scrape = useMutation({
    mutationFn: () => api.scrape(5),
    onSuccess: () => {
      toast('Scrape started...', 'info');
      qc.invalidateQueries({ queryKey: ['scrapeStatus'] });
    },
    onError: (err) => toast(err.message, 'error'),
  });
  const analyzeAll = useMutation({
    mutationFn: api.analyzeAll,
    onSuccess: (data) => {
      toast(`Queued ${data.queued} listings for analysis`, 'info');
      setTimeout(() => qc.invalidateQueries({ queryKey: ['dashboard'] }), 2000);
    },
    onError: (err) => toast(err.message, 'error'),
  });
  const refresh = useMutation({
    mutationFn: api.refresh,
    onSuccess: () => {
      toast('Refresh started...', 'info');
      qc.invalidateQueries({ queryKey: ['scrapeStatus'] });
    },
    onError: (err) => toast(err.message, 'error'),
  });

  if (isLoading) return <div className="text-gray-400 py-12 text-center">Loading...</div>;
  if (!data) return null;

  const { total, byStatus, hotDeals } = data;
  const hotPages = Math.ceil(hotDeals.length / HOT_PAGE_SIZE);
  const hotSlice = hotDeals.slice((hotPage - 1) * HOT_PAGE_SIZE, hotPage * HOT_PAGE_SIZE);

  const statuses = ['new', 'analyzed', 'contacted', 'negotiating', 'rejected', 'expired', 'bought'];
  const statusColors: Record<string, string> = {
    new: 'text-gray-600 dark:text-gray-300',
    analyzed: 'text-blue-600 dark:text-blue-400',
    contacted: 'text-yellow-600 dark:text-yellow-400',
    negotiating: 'text-purple-600 dark:text-purple-400',
    rejected: 'text-red-600 dark:text-red-400',
    expired: 'text-orange-500 dark:text-orange-400',
    bought: 'text-green-600 dark:text-green-400',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <div className="flex gap-2">
          <button
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending || scrapeStatus?.refreshing || scrapeStatus?.scraping}
            className="px-3 py-1.5 cursor-pointer bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 text-sm rounded transition-colors"
          >
            {scrapeStatus?.refreshing ? '⏳ Refreshing...' : '🔄 Refresh'}
          </button>
          <button
            onClick={() => scrape.mutate()}
            disabled={scrape.isPending || scrapeStatus?.scraping || scrapeStatus?.refreshing}
            className="px-3 py-1.5 cursor-pointer bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 text-sm rounded transition-colors"
          >
            {scrapeStatus?.scraping ? '⏳ Scraping...' : '🔍 Scrape'}
          </button>
          <button
            onClick={() => analyzeAll.mutate()}
            disabled={analyzeAll.isPending}
            className="px-3 py-1.5 cursor-pointer bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded transition-colors"
          >
            {analyzeAll.isPending ? '⏳ Analyzing...' : '🤖 Analyze all'}
          </button>
        </div>
      </div>

      {scrapeStatus?.lastRefreshResult && (
        <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-3 text-sm text-gray-600 dark:text-gray-400">
          Last refresh: checked {scrapeStatus.lastRefreshResult.checked},&nbsp;
          <span className="text-red-500">{scrapeStatus.lastRefreshResult.expired} expired</span>,&nbsp;
          <span className="text-yellow-500">{scrapeStatus.lastRefreshResult.priceChanged} price changes</span>
          {scrapeStatus.lastRefreshResult.errors > 0 && <>, <span className="text-red-400">{scrapeStatus.lastRefreshResult.errors} errors</span></>}
        </div>
      )}
      {analyzeAll.data && (
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded p-3 text-sm text-blue-700 dark:text-blue-300">
          Queued {analyzeAll.data.queued} listings for analysis — running in background.
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-7 gap-3">
        <div className="col-span-3 sm:col-span-1 bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="text-3xl font-bold">{total}</div>
          <div className="text-xs text-gray-400 mt-1">Total</div>
        </div>
        {statuses.map((s) => (
          <div key={s} className="bg-white dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-800 shadow-sm">
            <div className={`text-2xl font-bold ${statusColors[s]}`}>{byStatus[s] ?? 0}</div>
            <div className="text-xs text-gray-400 mt-1 capitalize">{s}</div>
          </div>
        ))}
      </div>

      {/* Hot Deals */}
      {hotDeals.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              🔥 Hot Deals (risk ≤ 4) <span className="text-gray-400 font-normal normal-case">({hotDeals.length})</span>
            </h2>
            {hotPages > 1 && (
              <div className="flex items-center gap-1 text-sm">
                <button onClick={() => setHotPage((p) => Math.max(1, p - 1))} disabled={hotPage === 1} className="px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">←</button>
                <span className="text-gray-400 px-1 text-xs">{hotPage}/{hotPages}</span>
                <button onClick={() => setHotPage((p) => Math.min(hotPages, p + 1))} disabled={hotPage === hotPages} className="px-2 py-0.5 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">→</button>
              </div>
            )}
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-xs text-gray-400">
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
                {hotSlice.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 text-gray-400">#{r.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.title}</div>
                      <div className="text-xs text-gray-400">{r.year} · {r.mileage ? `${r.mileage.toLocaleString()} km` : '—'} · {r.district ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{eur(r.price)}</td>
                    <td className="px-4 py-3 text-right text-green-600 dark:text-green-400">{eur(r.suggestedOffer)}</td>
                    <td className="px-4 py-3 text-center"><RiskBadge score={r.riskScore} /></td>
                    <td className="px-4 py-3"><RecBadge rec={r.recommendation} /></td>
                    <td className="px-4 py-3">
                      <Link to={`/listings/${r.id}`} className="text-blue-500 hover:text-blue-400 text-xs cursor-pointer">
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
