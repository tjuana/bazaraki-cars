import { Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard.tsx';
import Listings from './pages/Listings.tsx';
import ListingDetail from './pages/ListingDetail.tsx';
import Config from './pages/Config.tsx';
import { useTheme } from './hooks/useTheme.ts';

function Nav({ onToggleTheme, dark }: { onToggleTheme: () => void; dark: boolean }) {
  const base = 'px-3 py-1.5 rounded text-sm font-medium transition-colors';
  const active = `${base} bg-blue-600 text-white`;
  const inactive = `${base} text-gray-400 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800`;
  const cls = ({ isActive }: { isActive: boolean }) => (isActive ? active : inactive);

  return (
    <nav className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-2 sticky top-0 z-10">
      <span className="text-gray-900 dark:text-white font-bold mr-4 text-sm">🚗 bazaraki-cars</span>
      <NavLink to="/" end className={cls}>Dashboard</NavLink>
      <NavLink to="/listings" className={cls}>Listings</NavLink>
      <NavLink to="/config" className={cls}>Config</NavLink>
      <button
        onClick={onToggleTheme}
        className="ml-auto px-2 py-1.5 rounded text-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
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
