import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api/client.ts';
import { RiskBadge, RecBadge, eur } from '../components/Badge.tsx';
import { useToast } from '../components/Toast.tsx';

const HOT_PAGE_SIZE = 5;

const STATUS_COLORS: Record<string, string> = {
  new:         'var(--c-muted)',
  analyzed:    'var(--c-blue)',
  contacted:   'var(--c-accent)',
  negotiating: 'var(--c-purple)',
  rejected:    'var(--c-red)',
  expired:     '#fb923c',
  bought:      'var(--c-green)',
};

const STATUSES = ['new', 'analyzed', 'contacted', 'negotiating', 'rejected', 'expired', 'bought'];

function StatusChart({ byStatus, total }: { byStatus: Record<string, number>; total: number }) {
  if (total === 0) return null;
  return (
    <div className="card space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--c-muted)' }}>
        Status breakdown
      </h2>
      <div className="space-y-2">
        {STATUSES.filter((s) => (byStatus[s] ?? 0) > 0).map((s) => {
          const cnt = byStatus[s] ?? 0;
          const pct = Math.round((cnt / total) * 100);
          return (
            <div key={s} className="flex items-center gap-3">
              <div className="w-24 text-xs capitalize shrink-0" style={{ color: 'var(--c-muted)' }}>{s}</div>
              <div className="flex-1 rounded-full overflow-hidden" style={{ background: 'var(--c-surface-hi)', height: 6 }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: STATUS_COLORS[s] }}
                />
              </div>
              <div className="w-16 text-right text-xs mono" style={{ color: STATUS_COLORS[s] }}>
                {cnt} <span style={{ color: 'var(--c-muted)' }}>({pct}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RiskChart({ riskDistribution }: { riskDistribution: Record<number, number> }) {
  const entries = Array.from({ length: 10 }, (_, i) => ({ score: i + 1, count: riskDistribution[i + 1] ?? 0 }));
  const maxCount = Math.max(...entries.map((e) => e.count), 1);
  if (entries.every((e) => e.count === 0)) return null;

  const riskColor = (score: number) => {
    if (score <= 3) return 'var(--c-green)';
    if (score <= 5) return 'var(--c-accent)';
    if (score <= 7) return '#fb923c';
    return 'var(--c-red)';
  };

  return (
    <div className="card space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--c-muted)' }}>
        Risk distribution
      </h2>
      <div className="flex items-end gap-1.5" style={{ height: 80 }}>
        {entries.map(({ score, count }) => (
          <div key={score} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-t transition-all duration-500"
              style={{
                height: count > 0 ? `${Math.max(4, Math.round((count / maxCount) * 68))}px` : 2,
                background: count > 0 ? riskColor(score) : 'var(--c-border)',
                opacity: count > 0 ? 1 : 0.4,
              }}
              title={`Risk ${score}: ${count} listings`}
            />
            <div className="text-xs mono" style={{ color: 'var(--c-muted)', fontSize: 10 }}>{score}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-3 text-xs" style={{ color: 'var(--c-muted)' }}>
        <span style={{ color: 'var(--c-green)' }}>● 1–3 low</span>
        <span style={{ color: 'var(--c-accent)' }}>● 4–5 medium</span>
        <span style={{ color: '#fb923c' }}>● 6–7 caution</span>
        <span style={{ color: 'var(--c-red)' }}>● 8–10 high</span>
      </div>
    </div>
  );
}

function TimelineChart({
  data, label, color,
}: {
  data: Array<{ date: string; count: number }>;
  label: string;
  color: string;
}) {
  if (!data || data.length < 2) return null;

  // Fill last 30 days
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return d.toISOString().slice(0, 10);
  });
  const byDate = Object.fromEntries(data.map((r) => [r.date, r.count]));
  const points = days.map((d) => ({ date: d, count: byDate[d] ?? 0 }));
  const max = Math.max(...points.map((p) => p.count), 1);

  const W = 100, H = 40, PAD = 2;
  const pts = points.map((p, i) => {
    const x = PAD + (i / (points.length - 1)) * (W - PAD * 2);
    const y = PAD + ((max - p.count) / max) * (H - PAD * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const total = points.reduce((s, p) => s + p.count, 0);

  return (
    <div className="card space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--c-muted)' }}>{label}</h2>
        <span className="text-xs mono" style={{ color }}>
          {total} <span style={{ color: 'var(--c-muted)' }}>/ 30d</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 56 }}>
        <defs>
          <linearGradient id={`fill-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline
          points={pts}
          fill="none"
          stroke={color}
          strokeWidth="1.2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <polygon
          points={`${PAD},${H} ${pts} ${W - PAD},${H}`}
          fill={`url(#fill-${label})`}
        />
      </svg>
      <div className="flex justify-between text-xs" style={{ color: 'var(--c-muted)', fontSize: 10 }}>
        <span>{points[0]?.date.slice(5)}</span>
        <span>today</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [hotPage, setHotPage] = useState(1);
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: api.dashboard });
  const { data: scrapeStatus } = useQuery({ queryKey: ['scrapeStatus'], queryFn: api.scrapeStatus, refetchInterval: 3000 });

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
    onSuccess: () => { toast('Scrape started...', 'info'); qc.invalidateQueries({ queryKey: ['scrapeStatus'] }); },
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
    onSuccess: () => { toast('Refresh started...', 'info'); qc.invalidateQueries({ queryKey: ['scrapeStatus'] }); },
    onError: (err) => toast(err.message, 'error'),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center py-20 text-sm" style={{ color: 'var(--c-muted)' }}>
      Loading...
    </div>
  );
  if (!data) return null;

  const { total, byStatus, hotDeals, riskDistribution, priceChanges, expirations } = data;
  const hotPages = Math.ceil(hotDeals.length / HOT_PAGE_SIZE);
  const hotSlice = hotDeals.slice((hotPage - 1) * HOT_PAGE_SIZE, hotPage * HOT_PAGE_SIZE);

  const isBusy = scrapeStatus?.scraping || scrapeStatus?.refreshing;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold" style={{ color: 'var(--c-text)' }}>Dashboard</h1>
        <div className="flex gap-2">
          <button
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending || isBusy}
            className="px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-all disabled:opacity-40"
            style={{ background: 'var(--c-surface-hi)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}
          >
            {scrapeStatus?.refreshing ? '⏳ Refreshing...' : '↻ Refresh'}
          </button>
          <button
            onClick={() => scrape.mutate()}
            disabled={scrape.isPending || isBusy}
            className="px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-all disabled:opacity-40"
            style={{ background: 'var(--c-surface-hi)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}
          >
            {scrapeStatus?.scraping ? '⏳ Scraping...' : '⌕ Scrape'}
          </button>
          <button
            onClick={() => analyzeAll.mutate()}
            disabled={analyzeAll.isPending}
            className="px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-all disabled:opacity-40 text-white"
            style={{ background: 'var(--c-accent)' }}
          >
            {analyzeAll.isPending ? '⏳ Analyzing...' : '◈ Analyze all'}
          </button>
        </div>
      </div>

      {scrapeStatus?.lastRefreshResult && (
        <div className="rounded-lg px-4 py-2.5 text-xs" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', color: 'var(--c-muted)' }}>
          Last refresh: {scrapeStatus.lastRefreshResult.checked} checked ·{' '}
          <span style={{ color: 'var(--c-red)' }}>{scrapeStatus.lastRefreshResult.expired} expired</span> ·{' '}
          <span style={{ color: 'var(--c-accent)' }}>{scrapeStatus.lastRefreshResult.priceChanged} price changes</span>
          {scrapeStatus.lastRefreshResult.errors > 0 && (
            <> · <span style={{ color: 'var(--c-red)' }}>{scrapeStatus.lastRefreshResult.errors} errors</span></>
          )}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
        {/* Total — accent card */}
        <div
          className="col-span-2 sm:col-span-1 rounded-lg p-4"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}
        >
          <div className="mono text-3xl font-bold" style={{ color: 'var(--c-accent)' }}>{total}</div>
          <div className="text-xs font-medium mt-1.5 uppercase tracking-wide" style={{ color: 'rgba(245,158,11,0.6)' }}>Total</div>
        </div>

        {STATUSES.map((s) => (
          <div
            key={s}
            className="rounded-lg p-3"
            style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
          >
            <div className="mono text-xl font-semibold" style={{ color: STATUS_COLORS[s] }}>{byStatus[s] ?? 0}</div>
            <div className="text-xs mt-1 capitalize" style={{ color: 'var(--c-muted)' }}>{s}</div>
          </div>
        ))}
      </div>

      {/* Hot Deals */}
      {hotDeals.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--c-muted)' }}>
              <span style={{ color: 'var(--c-red)' }}>●</span> Hot Deals <span>(risk ≤ 4)</span>
              <span style={{ color: 'var(--c-border)' }}>·</span>
              <span>{hotDeals.length} total</span>
            </h2>
            {hotPages > 1 && (
              <div className="flex items-center gap-1 text-xs">
                <button
                  onClick={() => setHotPage((p) => Math.max(1, p - 1))}
                  disabled={hotPage === 1}
                  className="px-2 py-0.5 rounded cursor-pointer transition-colors disabled:opacity-30"
                  style={{ border: '1px solid var(--c-border)', color: 'var(--c-muted)' }}
                >←</button>
                <span style={{ color: 'var(--c-muted)' }} className="px-1">{hotPage}/{hotPages}</span>
                <button
                  onClick={() => setHotPage((p) => Math.min(hotPages, p + 1))}
                  disabled={hotPage === hotPages}
                  className="px-2 py-0.5 rounded cursor-pointer transition-colors disabled:opacity-30"
                  style={{ border: '1px solid var(--c-border)', color: 'var(--c-muted)' }}
                >→</button>
              </div>
            )}
          </div>

          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--c-border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--c-border)', background: 'var(--c-surface-hi)' }}>
                  <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--c-muted)' }}>ID</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--c-muted)' }}>Car</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--c-muted)' }}>Price</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--c-muted)' }}>Offer</th>
                  <th className="text-center px-4 py-2.5 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--c-muted)' }}>Risk</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--c-muted)' }}>Rec</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {hotSlice.map((r) => (
                  <tr
                    key={r.id}
                    className="transition-colors"
                    style={{ borderBottom: '1px solid var(--c-border)', background: 'var(--c-surface)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--c-surface-hi)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--c-surface)')}
                  >
                    <td className="px-4 py-3 mono text-xs" style={{ color: 'var(--c-muted)' }}>#{r.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-sm" style={{ color: 'var(--c-text)' }}>{r.title}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--c-muted)' }}>
                        {r.year} · {r.mileage ? `${r.mileage.toLocaleString()} km` : '—'} · {r.district ?? '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right mono font-medium" style={{ color: 'var(--c-text)' }}>{eur(r.price)}</td>
                    <td className="px-4 py-3 text-right mono font-semibold" style={{ color: 'var(--c-green)' }}>{eur(r.suggestedOffer)}</td>
                    <td className="px-4 py-3 text-center"><RiskBadge score={r.riskScore} /></td>
                    <td className="px-4 py-3"><RecBadge rec={r.recommendation} /></td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/listings/${r.id}`}
                        className="text-xs font-medium transition-colors hover:underline"
                        style={{ color: 'var(--c-accent)' }}
                      >
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

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatusChart byStatus={byStatus} total={total} />
        <RiskChart riskDistribution={riskDistribution ?? {}} />
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TimelineChart data={priceChanges ?? []} label="Price changes" color="var(--c-accent)" />
        <TimelineChart data={expirations ?? []} label="Expired listings" color="var(--c-red)" />
      </div>
    </div>
  );
}
