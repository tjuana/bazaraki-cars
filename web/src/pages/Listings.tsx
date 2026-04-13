import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.ts';
import { RiskBadge, RecBadge, StatusBadge, eur } from '../components/Badge.tsx';
import { useToast } from '../components/Toast.tsx';

const STATUSES = ['', 'new', 'analyzed', 'contacted', 'negotiating', 'rejected', 'expired', 'bought'];
const PAGE_SIZE = 25;

type SortKey = 'id' | 'price' | 'price_desc' | 'mileage' | 'mileage_desc' | 'risk' | 'year' | 'year_asc' | 'overprice' | 'overprice_desc';

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <span className="text-gray-400 ml-1 text-xs">⇅</span>;
  return <span className="text-blue-500 ml-1 text-xs">{dir === 'asc' ? '↑' : '↓'}</span>;
}

function Pagination({ page, total, pageSize, onChange }: { page: number; total: number; pageSize: number; onChange: (p: number) => void }) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 text-sm py-3">
      <button onClick={() => onChange(1)} disabled={page === 1} className="px-2 py-1 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-xs">«</button>
      <button onClick={() => onChange(page - 1)} disabled={page === 1} className="px-2 py-1 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">←</button>
      <span className="text-gray-500 dark:text-gray-400 px-2">{page} / {pages}</span>
      <button onClick={() => onChange(page + 1)} disabled={page === pages} className="px-2 py-1 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">→</button>
      <button onClick={() => onChange(pages)} disabled={page === pages} className="px-2 py-1 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer text-xs">»</button>
    </div>
  );
}

export default function Listings() {
  const [searchParams, setSearchParams] = useSearchParams({
    status: 'analyzed',
    sort: 'risk',
  });

  const status = searchParams.get('status') ?? '';
  const brand = searchParams.get('brand') ?? '';
  const maxPrice = searchParams.get('maxPrice') ?? '';
  const minYear = searchParams.get('minYear') ?? '';
  const sort = (searchParams.get('sort') ?? 'risk') as SortKey;
  const page = Number(searchParams.get('page') ?? '1');

  function set(key: string, value: string, resetPage = true) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value); else next.delete(key);
      if (resetPage) next.delete('page');
      return next;
    }, { replace: true });
  }

  function setPage(p: number) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (p > 1) next.set('page', String(p)); else next.delete('page');
      return next;
    }, { replace: true });
  }

  function toggleSort(asc: SortKey, desc: SortKey) {
    set('sort', sort === asc ? desc : asc);
  }

  const { data: brands = [] } = useQuery({
    queryKey: ['listings-brands'],
    queryFn: () => api.brands(),
    staleTime: 60_000,
  });

  const params: Record<string, string> = {
    sort,
    limit: String(PAGE_SIZE),
    offset: String((page - 1) * PAGE_SIZE),
  };
  if (status) params.status = status;
  if (brand) params.brand = brand;
  if (maxPrice) params.maxPrice = maxPrice;
  if (minYear) params.minYear = minYear;

  const { data, isLoading } = useQuery({
    queryKey: ['listings', params],
    queryFn: () => api.listings(params),
    placeholderData: (prev) => prev,
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;

  const qc = useQueryClient();
  const { toast } = useToast();
  const rejectMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => api.updateStatus(id, status),
    onSuccess: (_, { id, status }) => {
      qc.invalidateQueries({ queryKey: ['listings'] });
      if (status === 'rejected') {
        const row = rows.find((r) => r.id === id);
        toast(`Rejected: ${row?.title ?? `#${id}`}`, 'info', {
          duration: 6000,
          action: {
            label: 'Undo',
            onClick: () => rejectMut.mutate({ id, status: 'analyzed' }),
          },
        });
      }
    },
  });

  const input = 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-3 py-1.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500';

  function Th({ label, asc: a, desc: d, align = 'left' }: { label: string; asc: SortKey; desc: SortKey; align?: string }) {
    const active = sort === a || sort === d;
    const dir = sort === d ? 'desc' : 'asc';
    return (
      <th
        onClick={() => toggleSort(a, d)}
        className={`px-4 py-2 text-${align} cursor-pointer select-none text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors whitespace-nowrap`}
      >
        {label}<SortIcon active={active} dir={dir} />
      </th>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select value={status} onChange={(e) => set('status', e.target.value)} className={input}>
          {STATUSES.map((s) => <option key={s} value={s}>{s || 'All statuses'}</option>)}
        </select>
        <select value={brand} onChange={(e) => set('brand', e.target.value)} className={input}>
          <option value="">All brands</option>
          {brands.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <input type="number" placeholder="Max price €" value={maxPrice} onChange={(e) => set('maxPrice', e.target.value)} className={`${input} w-32`} />
        <input type="number" placeholder="Min year" value={minYear} onChange={(e) => set('minYear', e.target.value)} className={`${input} w-28`} />
        <span className="text-gray-400 text-sm ml-auto">{total} listings</span>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm overflow-x-auto">
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No listings found</div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left px-4 py-2 text-xs text-gray-400">ID</th>
                  <th className="text-left px-4 py-2 text-xs text-gray-400">Car</th>
                  <Th label="Price" asc="price" desc="price_desc" align="right" />
                  <Th label="Year" asc="year_asc" desc="year" align="right" />
                  <Th label="Mileage" asc="mileage" desc="mileage_desc" align="right" />
                  <Th label="Risk" asc="risk" desc="risk" align="center" />
                  <th className="text-left px-4 py-2 text-xs text-gray-400">Rec</th>
                  <th className="text-left px-4 py-2 text-xs text-gray-400">Status</th>
                  <Th label="Overpriced" asc="overprice" desc="overprice_desc" align="right" />
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
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
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link to={`/listings/${r.id}`} className="text-blue-500 hover:text-blue-400 text-xs cursor-pointer">
                        View
                      </Link>
                      {r.status !== 'rejected' && r.status !== 'expired' && r.status !== 'bought' && (
                        <button
                          onClick={() => rejectMut.mutate({ id: r.id, status: 'rejected' })}
                          className="text-red-400 hover:text-red-600 text-xs ml-3 cursor-pointer"
                          title="Reject"
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} total={total} pageSize={PAGE_SIZE} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
