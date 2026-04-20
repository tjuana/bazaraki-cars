import { Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard.tsx';
import Listings from './pages/Listings.tsx';
import ListingDetail from './pages/ListingDetail.tsx';
import Config from './pages/Config.tsx';
import { useTheme } from './hooks/useTheme.ts';

function Nav({ onToggleTheme, dark }: { onToggleTheme: () => void; dark: boolean }) {
  const base = 'px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150';
  const active = `${base} bg-amber-500/12 text-amber-600 dark:text-amber-400`;
  const inactive = `${base} text-gray-500 dark:text-[var(--c-muted)] hover:text-gray-800 dark:hover:text-[var(--c-text)] hover:bg-black/6 dark:hover:bg-white/5`;
  const cls = ({ isActive }: { isActive: boolean }) => (isActive ? active : inactive);

  return (
    <nav
      className="sticky top-0 z-10 border-b px-5 py-3 flex items-center gap-1"
      style={{
        background: dark ? 'rgba(13,14,17,0.85)' : 'rgba(255,255,255,0.85)',
        borderColor: 'var(--c-border)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div className="flex items-center gap-2 mr-5">
        <span className="text-base leading-none">🚗</span>
        <span className="font-bold text-sm tracking-tight" style={{ color: 'var(--c-text)' }}>
          bazaraki<span style={{ color: 'var(--c-accent)' }}>-cars</span>
        </span>
      </div>

      <NavLink to="/" end className={cls}>Dashboard</NavLink>
      <NavLink to="/listings" className={cls}>Listings</NavLink>
      <NavLink to="/config" className={cls}>Config</NavLink>

      <button
        onClick={onToggleTheme}
        className="ml-auto w-8 h-8 flex items-center justify-center rounded-md text-sm transition-colors hover:bg-black/8 dark:hover:bg-white/8"
        style={{ color: 'var(--c-muted)' }}
        title="Toggle theme"
      >
        {dark ? '☀️' : '🌙'}
      </button>
    </nav>
  );
}

export default function App() {
  const { dark, toggle } = useTheme();

  return (
    <div className="min-h-screen" style={{ color: 'var(--c-text)' }}>
      <Nav onToggleTheme={toggle} dark={dark} />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/listings" element={<Listings />} />
          <Route path="/listings/:id" element={<ListingDetail />} />
          <Route path="/config" element={<Config />} />
        </Routes>
      </main>
    </div>
  );
}
