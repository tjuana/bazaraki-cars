export function RiskBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-xs mono" style={{ color: 'var(--c-muted)' }}>—</span>;

  const [bg, ring, color] =
    score <= 3
      ? ['rgba(52,211,153,0.12)', 'rgba(52,211,153,0.3)', 'var(--c-green)']
      : score <= 5
      ? ['rgba(245,158,11,0.12)', 'rgba(245,158,11,0.3)', 'var(--c-accent)']
      : score <= 7
      ? ['rgba(251,146,60,0.12)', 'rgba(251,146,60,0.3)', '#fb923c']
      : ['rgba(248,113,113,0.12)', 'rgba(248,113,113,0.3)', 'var(--c-red)'];

  return (
    <span
      className="mono text-xs font-semibold px-2 py-0.5 rounded"
      style={{ background: bg, color, outline: `1px solid ${ring}` }}
    >
      {score}/10
    </span>
  );
}

export function RecBadge({ rec }: { rec: string | null }) {
  if (!rec) return <span className="text-xs" style={{ color: 'var(--c-muted)' }}>—</span>;

  const styles: Record<string, [string, string, string]> = {
    strong_buy: ['rgba(52,211,153,0.12)', 'rgba(52,211,153,0.3)', 'var(--c-green)'],
    buy:        ['rgba(52,211,153,0.10)', 'rgba(52,211,153,0.25)', 'var(--c-green)'],
    negotiate:  ['rgba(245,158,11,0.12)', 'rgba(245,158,11,0.3)', 'var(--c-accent)'],
    caution:    ['rgba(251,146,60,0.12)', 'rgba(251,146,60,0.3)', '#fb923c'],
    avoid:      ['rgba(248,113,113,0.12)', 'rgba(248,113,113,0.3)', 'var(--c-red)'],
  };

  const labels: Record<string, string> = {
    strong_buy: '★ Strong buy',
    buy:        '✓ Buy',
    negotiate:  '↕ Negotiate',
    caution:    '⚠ Caution',
    avoid:      '✗ Avoid',
  };

  const [bg, ring, color] = styles[rec] ?? ['rgba(100,100,120,0.1)', 'rgba(100,100,120,0.2)', 'var(--c-muted)'];

  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded whitespace-nowrap"
      style={{ background: bg, color, outline: `1px solid ${ring}` }}
    >
      {labels[rec] ?? rec}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, [string, string]> = {
    new:         ['rgba(100,105,130,0.12)', 'var(--c-muted)'],
    analyzed:    ['rgba(96,165,250,0.12)', 'var(--c-blue)'],
    contacted:   ['rgba(245,158,11,0.12)', 'var(--c-accent)'],
    liked:       ['rgba(234,179,8,0.15)', '#eab308'],
    negotiating: ['rgba(167,139,250,0.12)', 'var(--c-purple)'],
    rejected:    ['rgba(248,113,113,0.12)', 'var(--c-red)'],
    expired:     ['rgba(251,146,60,0.12)', '#fb923c'],
    bought:      ['rgba(52,211,153,0.12)', 'var(--c-green)'],
  };

  const [bg, color] = styles[status] ?? ['rgba(100,105,130,0.1)', 'var(--c-muted)'];

  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded capitalize"
      style={{ background: bg, color }}
    >
      {status === 'liked' ? '★ liked' : status}
    </span>
  );
}

export function eur(cents: number | null): string {
  if (cents === null) return '—';
  return `€${(cents / 100).toLocaleString()}`;
}
