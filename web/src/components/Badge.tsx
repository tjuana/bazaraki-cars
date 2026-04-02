export function RiskBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-400 text-xs">—</span>;
  const color =
    score <= 3 ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' :
    score <= 5 ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300' :
    score <= 7 ? 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300' :
    'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300';
  return <span className={`${color} text-xs px-2 py-0.5 rounded-full font-medium`}>{score}/10</span>;
}

export function RecBadge({ rec }: { rec: string | null }) {
  if (!rec) return <span className="text-gray-400 text-xs">—</span>;
  const map: Record<string, string> = {
    strong_buy: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200',
    buy:        'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300',
    negotiate:  'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300',
    caution:    'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300',
    avoid:      'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300',
  };
  const labels: Record<string, string> = {
    strong_buy: '★ Strong buy',
    buy: '✓ Buy',
    negotiate: '↕ Negotiate',
    caution: '⚠ Caution',
    avoid: '✗ Avoid',
  };
  return (
    <span className={`${map[rec] ?? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'} text-xs px-2 py-0.5 rounded-full font-medium`}>
      {labels[rec] ?? rec}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    new:         'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300',
    analyzed:    'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
    contacted:   'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300',
    negotiating: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300',
    rejected:    'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400',
    bought:      'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
  };
  return (
    <span className={`${map[status] ?? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'} text-xs px-2 py-0.5 rounded-full`}>
      {status}
    </span>
  );
}

export function eur(cents: number | null): string {
  if (cents === null) return '—';
  return `€${(cents / 100).toLocaleString()}`;
}
