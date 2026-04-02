import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, type ListingRow } from '../api/client.ts';
import { RiskBadge, RecBadge, StatusBadge, eur } from '../components/Badge.tsx';

const STATUSES = ['', 'new', 'analyzed', 'contacted', 'negotiating', 'rejected', 'bought'];

type SortKey = 'id' | 'price' | 'mileage' | 'riskScore' | 'year' | 'overpricePercent';
type SortDir = 'asc' | 'desc';

function getValue(row: ListingRow, key: SortKey): number {
  const v = row[key];
  return v === null || v === undefined ? (key === 'riskScore' ? 99 : Infinity) : v;
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span className="text-gray-400 ml-1 text-xs">⇅</span>;
  return <span className="text-blue-500 ml-1 text-xs">{dir === 'asc' ? '↑' : '↓'}</span>;
}

export default function Listings() {
  const [status, setStatus] = useState('analyzed');
  const [maxPrice, setMaxPrice] = useState('');
  const [minYear, setMinYear] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('riskScore');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const params: Record<string, string> = { limit: '500' };
  if (status) params.status = status;
  if (maxPrice) params.maxPrice = maxPrice;
  if (minYear) params.minYear = minYear;

  const { data = [], isLoading } = useQuery({
    queryKey: ['listings', params],
    queryFn: () => api.listings(params),
  });

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const av = getValue(a, sortKey);
      const bv = getValue(b, sortKey);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [data, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  const input = 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-3 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500';

  function Th({ label, col, align = 'left' }: { label: string; col: SortKey; align?: 'left' | 'right' | 'center' }) {
    const active = sortKey === col;
    return (
      <th
        onClick={() => handleSort(col)}
        className={`px-4 py-2 text-${align} cursor-pointer select-none text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors whitespace-nowrap`}
      >
        {label}<SortIcon active={active} dir={sortDir} />
      </th>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={input}>
          {STATUSES.map((s) => <option key={s} value={s}>{s || 'All statuses'}</option>)}
        </select>
        <input type="number" placeholder="Max price €" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className={`${input} w-32`} />
        <input type="number" placeholder="Min year" value={minYear} onChange={(e) => setMinYear(e.target.value)} className={`${input} w-28`} />
        <span className="text-gray-400 text-sm ml-auto">{sorted.length} listings</span>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm overflow-x-auto">
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No listings found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="text-left px-4 py-2 text-xs text-gray-400">ID</th>
                <th className="text-left px-4 py-2 text-xs text-gray-400">Car</th>
                <Th label="Price" col="price" align="right" />
                <Th label="Year" col="year" align="right" />
                <Th label="Mileage" col="mileage" align="right" />
                <Th label="Risk" col="riskScore" align="center" />
                <th className="text-left px-4 py-2 text-xs text-gray-400">Rec</th>
                <th className="text-left px-4 py-2 text-xs text-gray-400">Status</th>
                <Th label="Overpriced" col="overpricePercent" align="right" />
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 text-gray-400 text-xs">#{r.id}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm leading-tight">{r.title}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{r.fuelType ?? '?'} · {r.district ?? '?'}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{eur(r.price)}</td>
                  <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-300">{r.year ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-300">
                    {r.mileage ? `${r.mileage.toLocaleString()} km` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center"><RiskBadge score={r.riskScore} /></td>
                  <td className="px-4 py-3"><RecBadge rec={r.recommendation} /></td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-right text-xs">
                    {r.overpricePercent !== null ? (
                      <span className={r.overpricePercent > 0 ? 'text-red-500' : 'text-green-500'}>
                        {r.overpricePercent > 0 ? '+' : ''}{r.overpricePercent}%
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/listings/${r.id}`} className="text-blue-500 hover:text-blue-400 text-xs whitespace-nowrap cursor-pointer">
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
