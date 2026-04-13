import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api, type Config } from '../api/client.ts';
import { useToast } from '../components/Toast.tsx';

export default function Config() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery({ queryKey: ['config'], queryFn: api.config });
  const [form, setForm] = useState<Partial<Config>>({});

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: () => api.saveConfig(form),
    onSuccess: () => toast('Config saved', 'success'),
    onError: (err) => toast(`Failed to save: ${err.message}`, 'error'),
  });

  if (isLoading) return <div className="text-gray-500 py-12 text-center">Loading...</div>;

  const set = <K extends keyof Config>(key: K, value: Config[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-bold text-white">Search Config</h1>

      <div className="bg-gray-900 rounded-lg border border-gray-800 p-5 space-y-5">
        {/* Budget */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase block mb-2">Budget (€)</label>
          <div className="flex gap-3">
            <div className="flex-1">
              <div className="text-xs text-gray-600 mb-1">Min</div>
              <input
                type="number"
                value={form.budget?.min ?? ''}
                onChange={(e) => set('budget', { min: Number(e.target.value), max: form.budget?.max ?? 0 })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white"
              />
            </div>
            <div className="flex-1">
              <div className="text-xs text-gray-600 mb-1">Max</div>
              <input
                type="number"
                value={form.budget?.max ?? ''}
                onChange={(e) => set('budget', { min: form.budget?.min ?? 0, max: Number(e.target.value) })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white"
              />
            </div>
          </div>
        </div>

        {/* Year */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase block mb-2">Year range</label>
          <div className="flex gap-3">
            <div className="flex-1">
              <div className="text-xs text-gray-600 mb-1">From</div>
              <input
                type="number"
                value={form.minYear ?? ''}
                onChange={(e) => set('minYear', e.target.value ? Number(e.target.value) : null)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white"
              />
            </div>
            <div className="flex-1">
              <div className="text-xs text-gray-600 mb-1">To (optional)</div>
              <input
                type="number"
                value={form.maxYear ?? ''}
                onChange={(e) => set('maxYear', e.target.value ? Number(e.target.value) : null)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white"
              />
            </div>
          </div>
        </div>

        {/* Mileage */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase block mb-2">Max Mileage (km)</label>
          <input
            type="number"
            value={form.maxMileage ?? ''}
            onChange={(e) => set('maxMileage', Number(e.target.value))}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white"
          />
        </div>

        {/* Transmission */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase block mb-2">Transmission</label>
          <select
            value={form.transmission ?? ''}
            onChange={(e) => set('transmission', e.target.value || null)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white"
          >
            <option value="">Any</option>
            <option value="automatic">Automatic</option>
            <option value="manual">Manual</option>
          </select>
        </div>

        {/* Fuel */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase block mb-2">Fuel types</label>
          <div className="flex flex-wrap gap-2">
            {['petrol', 'diesel', 'hybrid', 'electric', 'lpg'].map((f) => {
              const selected = (form.fuelTypes ?? []).includes(f);
              return (
                <button
                  key={f}
                  onClick={() => set('fuelTypes', selected
                    ? (form.fuelTypes ?? []).filter((x) => x !== f)
                    : [...(form.fuelTypes ?? []), f]
                  )}
                  className={`px-3 py-1 rounded text-sm transition-colors ${selected ? 'bg-blue-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
                >
                  {f}
                </button>
              );
            })}
          </div>
        </div>

        {/* Brands */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase block mb-2">Brands (comma-separated)</label>
          <input
            type="text"
            value={(form.brands ?? []).join(', ')}
            onChange={(e) => set('brands', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white"
            placeholder="toyota, honda, nissan"
          />
        </div>

        {/* Models */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase block mb-2">Models (comma-separated)</label>
          <input
            type="text"
            value={(form.models ?? []).join(', ')}
            onChange={(e) => set('models', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white"
            placeholder="yaris, corolla"
          />
        </div>

        {/* Scrape pages */}
        <div>
          <label className="text-xs font-medium text-gray-500 uppercase block mb-2">Max scrape pages</label>
          <input
            type="number"
            value={form.scrapeMaxPages ?? ''}
            onChange={(e) => set('scrapeMaxPages', Number(e.target.value))}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white"
          />
        </div>

        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="px-4 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-sm rounded transition-colors font-medium"
        >
          {save.isPending ? 'Saving...' : 'Save config'}
        </button>
      </div>

      <div className="bg-yellow-950 border border-yellow-800 rounded p-4 text-sm text-yellow-300">
        <div className="font-medium mb-1">⚠️ Scraping limitations</div>
        <ul className="text-yellow-400/80 space-y-1 text-xs">
          <li>• Bazaraki has no official API — scraping may break if they redesign the site</li>
          <li>• Run scrape during off-peak hours to avoid rate limiting</li>
          <li>• WhatsApp numbers are rarely listed — primary contact method is phone call</li>
        </ul>
      </div>
    </div>
  );
}
