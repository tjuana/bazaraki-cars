import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.ts';
import { RiskBadge, RecBadge, StatusBadge, eur } from '../components/Badge.tsx';
import { useToast } from '../components/Toast.tsx';

const STATUSES = ['', 'new', 'analyzed', 'liked', 'contacted', 'negotiating', 'rejected', 'expired', 'bought'];
const PAGE_SIZE = 25;

type SortKey = 'id' | 'price' | 'price_desc' | 'mileage' | 'mileage_desc' | 'risk' | 'year' | 'year_asc' | 'overprice' | 'overprice_desc';

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <span className="ml-1 text-xs" style={{ color: 'var(--c-border)' }}>⇅</span>;
  return <span className="ml-1 text-xs" style={{ color: 'var(--c-accent)' }}>{dir === 'asc' ? '↑' : '↓'}</span>;
}

function Pagination({ page, total, pageSize, onChange }: { page: number; total: number; pageSize: number; onChange: (p: number) => void }) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  const btnCls = 'px-2 py-1 rounded-md text-xs cursor-pointer transition-all disabled:opacity-25';
  return (
    <div className="flex items-center justify-center gap-1.5 py-3" style={{ borderTop: '1px solid var(--c-border)' }}>
      <button onClick={() => onChange(1)} disabled={page === 1} className={btnCls}
        style={{ border: '1px solid var(--c-border)', color: 'var(--c-muted)' }}>«</button>
      <button onClick={() => onChange(page - 1)} disabled={page === 1} className={btnCls}
        style={{ border: '1px solid var(--c-border)', color: 'var(--c-muted)' }}>←</button>
      <span className="px-3 text-xs" style={{ color: 'var(--c-muted)' }}>{page} / {pages}</span>
      <button onClick={() => onChange(page + 1)} disabled={page === pages} className={btnCls}
        style={{ border: '1px solid var(--c-border)', color: 'var(--c-muted)' }}>→</button>
      <button onClick={() => onChange(pages)} disabled={page === pages} className={btnCls}
        style={{ border: '1px solid var(--c-border)', color: 'var(--c-muted)' }}>»</button>
    </div>
  );
}

function FilterSelect({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-md pl-3 pr-7 py-1.5 text-sm outline-none cursor-pointer transition-all"
        style={{
          background: 'var(--c-surface)',
          border: '1px solid var(--c-border)',
          color: value ? 'var(--c-text)' : 'var(--c-muted)',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--c-accent)')}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--c-border)')}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--c-muted)' }}>▾</span>
    </div>
  );
}

function FilterInput({ value, onChange, placeholder, width = 'w-32' }: { value: string; onChange: (v: string) => void; placeholder: string; width?: string }) {
  return (
    <input
      type="number"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${width} rounded-md px-3 py-1.5 text-sm outline-none transition-all`}
      style={{
        background: 'var(--c-surface)',
        border: '1px solid var(--c-border)',
        color: 'var(--c-text)',
      }}
      onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--c-accent)')}
      onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--c-border)')}
    />
  );
}

export default function Listings() {
  const [searchParams, setSearchParams] = useSearchParams({ status: 'analyzed', sort: 'risk' });

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

  const { data: brands = [] } = useQuery({ queryKey: ['listings-brands'], queryFn: () => api.brands(), staleTime: 60_000 });

  const params: Record<string, string> = {
    sort, limit: String(PAGE_SIZE), offset: String((page - 1) * PAGE_SIZE),
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
          action: { label: 'Undo', onClick: () => rejectMut.mutate({ id, status: 'analyzed' }) },
        });
      }
    },
  });

  function Th({ label, asc: a, desc: d, align = 'left' }: { label: string; asc: SortKey; desc: SortKey; align?: string }) {
    const active = sort === a || sort === d;
    const dir = sort === d ? 'desc' : 'asc';
    return (
      <th
        onClick={() => toggleSort(a, d)}
        className={`px-4 py-2.5 text-${align} cursor-pointer select-none text-xs font-medium uppercase tracking-wide whitespace-nowrap transition-colors`}
        style={{ color: active ? 'var(--c-accent)' : 'var(--c-muted)' }}
      >
        {label}<SortIcon active={active} dir={dir} />
      </th>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <FilterSelect value={status} onChange={(v) => set('status', v)}>
          {STATUSES.map((s) => <option key={s} value={s}>{s || 'All statuses'}</option>)}
        </FilterSelect>
        <FilterSelect value={brand} onChange={(v) => set('brand', v)}>
          <option value="">All brands</option>
          {brands.map((b) => <option key={b} value={b}>{b}</option>)}
        </FilterSelect>
        <FilterInput value={maxPrice} onChange={(v) => set('maxPrice', v)} placeholder="Max price €" />
        <FilterInput value={minYear} onChange={(v) => set('minYear', v)} placeholder="Min year" width="w-28" />
        {(status || brand || maxPrice || minYear) && (
          <button
            onClick={() => setSearchParams({ status: 'analyzed', sort }, { replace: true })}
            className="text-xs px-2 py-1.5 rounded-md transition-colors cursor-pointer"
            style={{ color: 'var(--c-muted)', border: '1px solid var(--c-border)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--c-red)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--c-muted)')}
          >✕ clear</button>
        )}
        <span className="ml-auto text-xs mono" style={{ color: 'var(--c-muted)' }}>{total} listings</span>
      </div>

      {/* Table */}
      <div className="rounded-lg overflow-x-auto" style={{ border: '1px solid var(--c-border)' }}>
        {isLoading ? (
          <div className="text-center py-12 text-sm" style={{ color: 'var(--c-muted)' }}>Loading...</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-sm" style={{ color: 'var(--c-muted)' }}>No listings found</div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--c-border)', background: 'var(--c-surface-hi)' }}>
                  <th className="w-12 px-2 py-2.5"></th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--c-muted)' }}>Car</th>
                  <Th label="Price" asc="price" desc="price_desc" align="right" />
                  <Th label="Year" asc="year_asc" desc="year" align="right" />
                  <Th label="Mileage" asc="mileage" desc="mileage_desc" align="right" />
                  <Th label="Risk" asc="risk" desc="risk" align="center" />
                  <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--c-muted)' }}>Rec</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--c-muted)' }}>Status</th>
                  <Th label="Overprice" asc="overprice" desc="overprice_desc" align="right" />
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="transition-colors"
                    style={{ borderBottom: '1px solid var(--c-border)', background: 'var(--c-surface)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--c-surface-hi)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--c-surface)')}
                  >
                    <td className="px-2 py-1.5 w-12">
                      {r.imageUrls?.[0] ? (
                        <img src={r.imageUrls[0]} alt="" className="w-10 h-10 object-cover rounded" style={{ border: '1px solid var(--c-border)' }} />
                      ) : (
                        <div className="w-10 h-10 rounded flex items-center justify-center text-xs" style={{ background: 'var(--c-surface-hi)', color: 'var(--c-muted)', border: '1px solid var(--c-border)' }}>?</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-sm leading-tight" style={{ color: 'var(--c-text)' }}>{r.title}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--c-muted)' }}>{r.fuelType ?? '?'} · {r.district ?? '?'}</div>
                    </td>
                    <td className="px-4 py-2.5 text-right mono font-medium" style={{ color: 'var(--c-text)' }}>{eur(r.price)}</td>
                    <td className="px-4 py-2.5 text-right mono" style={{ color: 'var(--c-muted)' }}>{r.year ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right mono text-xs" style={{ color: 'var(--c-muted)' }}>
                      {r.mileage ? `${r.mileage.toLocaleString()} km` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-center"><RiskBadge score={r.riskScore} /></td>
                    <td className="px-4 py-2.5"><RecBadge rec={r.recommendation} /></td>
                    <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-2.5 text-right mono text-xs">
                      {r.overpricePercent !== null ? (
                        <span style={{ color: r.overpricePercent > 0 ? 'var(--c-red)' : 'var(--c-green)' }}>
                          {r.overpricePercent > 0 ? '+' : ''}{r.overpricePercent}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <Link
                        to={`/listings/${r.id}`}
                        className="text-xs font-medium transition-colors hover:underline"
                        style={{ color: 'var(--c-accent)' }}
                      >
                        View
                      </Link>
                      {r.status !== 'rejected' && r.status !== 'expired' && r.status !== 'bought' && (
                        <button
                          onClick={() => rejectMut.mutate({ id: r.id, status: 'rejected' })}
                          className="text-xs ml-3 cursor-pointer transition-colors"
                          style={{ color: 'var(--c-muted)' }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--c-red)')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--c-muted)')}
                          title="Reject"
                        >✕</button>
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
