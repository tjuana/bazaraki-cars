import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api/client.ts';
import { RiskBadge, RecBadge, StatusBadge, eur } from '../components/Badge.tsx';

const STATUSES = ['', 'new', 'analyzed', 'contacted', 'negotiating', 'rejected', 'bought'];
const SORTS = [
  { value: 'id', label: 'Newest' },
  { value: 'risk', label: 'Risk (best first)' },
  { value: 'price', label: 'Price ↑' },
  { value: 'price_desc', label: 'Price ↓' },
  { value: 'mileage', label: 'Mileage ↑' },
];

export default function Listings() {
  const [status, setStatus] = useState('analyzed');
  const [sort, setSort] = useState('risk');
  const [maxPrice, setMaxPrice] = useState('');
  const [minYear, setMinYear] = useState('');

  const params: Record<string, string> = { sort, limit: '200' };
  if (status) params.status = status;
  if (maxPrice) params.maxPrice = maxPrice;
  if (minYear) params.minYear = minYear;

  const { data = [], isLoading } = useQuery({
    queryKey: ['listings', params],
    queryFn: () => api.listings(params),
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s || 'All statuses'}</option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <input
          type="number"
          placeholder="Max price €"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white w-32"
        />

        <input
          type="number"
          placeholder="Min year"
          value={minYear}
          onChange={(e) => setMinYear(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white w-28"
        />

        <span className="text-gray-500 text-sm ml-auto">{data.length} listings</span>
      </div>

      {/* Table */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-x-auto">
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : data.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No listings found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-xs">
                <th className="text-left px-4 py-2">ID</th>
                <th className="text-left px-4 py-2">Car</th>
                <th className="text-right px-4 py-2">Price</th>
                <th className="text-right px-4 py-2">Mileage</th>
                <th className="text-center px-4 py-2">Risk</th>
                <th className="text-left px-4 py-2">Rec</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Phone</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 text-gray-500 text-xs">#{r.id}</td>
                  <td className="px-4 py-3">
                    <div className="text-white font-medium text-sm leading-tight">{r.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{r.year} · {r.fuelType ?? '?'} · {r.district ?? '?'}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-white">{eur(r.price)}</td>
                  <td className="px-4 py-3 text-right text-gray-300">
                    {r.mileage ? `${r.mileage.toLocaleString()} km` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center"><RiskBadge score={r.riskScore} /></td>
                  <td className="px-4 py-3"><RecBadge rec={r.recommendation} /></td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {r.phoneNormalized ? `+${r.phoneNormalized}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/listings/${r.id}`} className="text-blue-400 hover:text-blue-300 text-xs whitespace-nowrap">
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
