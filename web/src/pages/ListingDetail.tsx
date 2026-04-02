import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.ts';
import { RiskBadge, RecBadge, StatusBadge, eur } from '../components/Badge.tsx';

const OUTCOMES = [
  { value: '', label: 'Select outcome...' },
  { value: 'interested', label: '✅ Interested' },
  { value: 'too_expensive', label: '💬 Too expensive (negotiating)' },
  { value: 'not_responding', label: '📵 Not responding' },
  { value: 'rejected', label: '❌ Rejected' },
];

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['listing', id],
    queryFn: () => api.listing(Number(id)),
  });

  const [notes, setNotes] = useState('');
  const [checked, setChecked] = useState<number[]>([]);
  const [outcome, setOutcome] = useState('');
  const [notesLoaded, setNotesLoaded] = useState(false);

  // Init form from DB once data loads
  if (data?.callNotes && !notesLoaded) {
    setNotes(data.callNotes.notes ?? '');
    setChecked(data.callNotes.checkedQuestions ?? []);
    setOutcome(data.callNotes.outcome ?? '');
    setNotesLoaded(true);
  }

  const saveNotes = useMutation({
    mutationFn: () => api.saveCallNotes(Number(id), {
      notes,
      checkedQuestions: checked,
      outcome: outcome || undefined,
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['listing', id] }),
  });

  const analyze = useMutation({
    mutationFn: () => api.analyze(Number(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['listing', id] }),
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => api.updateStatus(Number(id), status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['listing', id] }),
  });

  if (isLoading) return <div className="text-gray-500 py-12 text-center">Loading...</div>;
  if (!data) return <div className="text-red-400 py-12 text-center">Not found</div>;

  const { listing, analysis, callNotes } = data;
  const questions = analysis?.questionsForSeller ?? [];
  const risks = analysis?.risks ?? [];

  const toggleCheck = (i: number) => {
    setChecked((prev) => prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]);
  };

  const waLink = listing.phoneNormalized
    ? `https://wa.me/${listing.phoneNormalized}`
    : null;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/listings" className="hover:text-gray-300">← Listings</Link>
        <span>/</span>
        <span>#{listing.id}</span>
      </div>

      {/* Header */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-white">{listing.title}</h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <StatusBadge status={listing.status} />
              {analysis && <RiskBadge score={analysis.riskScore} />}
              {analysis && <RecBadge rec={analysis.recommendation} />}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-bold text-white">{eur(listing.price)}</div>
            {analysis?.suggestedOffer && (
              <div className="text-sm text-green-400">Offer: {eur(analysis.suggestedOffer)}</div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm">
          {[
            ['Year', listing.year ?? '—'],
            ['Mileage', listing.mileage ? `${listing.mileage.toLocaleString()} km` : '—'],
            ['Fuel', listing.fuelType ?? '—'],
            ['Gearbox', listing.transmission ?? '—'],
            ['Engine', listing.engineSize ? `${listing.engineSize}L` : '—'],
            ['Seller', listing.sellerType],
            ['District', listing.district ?? '—'],
            ['Phone', listing.phoneNormalized ? `+${listing.phoneNormalized}` : '—'],
          ].map(([label, val]) => (
            <div key={label}>
              <div className="text-xs text-gray-500">{label}</div>
              <div className="text-gray-200">{val}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-4 flex-wrap">
          <a href={listing.url} target="_blank" rel="noreferrer"
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-xs rounded transition-colors">
            Open on Bazaraki ↗
          </a>
          {waLink && (
            <a href={waLink} target="_blank" rel="noreferrer"
              className="px-3 py-1.5 bg-green-800 hover:bg-green-700 text-xs rounded transition-colors">
              WhatsApp ↗
            </a>
          )}
          {!analysis && (
            <button onClick={() => analyze.mutate()}
              disabled={analyze.isPending}
              className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-xs rounded transition-colors">
              {analyze.isPending ? 'Analyzing...' : '🤖 Analyze with AI'}
            </button>
          )}
          <select
            value={listing.status}
            onChange={(e) => updateStatus.mutate(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-xs text-white ml-auto"
          >
            {['new', 'analyzed', 'contacted', 'negotiating', 'rejected', 'bought'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* AI Analysis */}
      {analysis && (
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-5 space-y-4">
          <h2 className="font-semibold text-white">AI Analysis</h2>

          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="bg-gray-800 rounded p-3">
              <div className="text-xs text-gray-500">Fair value</div>
              <div className="text-white font-medium">
                {eur(analysis.fairPriceMin)} – {eur(analysis.fairPriceMax)}
              </div>
            </div>
            <div className="bg-gray-800 rounded p-3">
              <div className="text-xs text-gray-500">Overprice</div>
              <div className={`font-medium ${analysis.overpricePercent > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {analysis.overpricePercent > 0 ? '+' : ''}{analysis.overpricePercent}%
              </div>
            </div>
            <div className="bg-gray-800 rounded p-3">
              <div className="text-xs text-gray-500">Risk score</div>
              <div className="font-medium text-white">{analysis.riskScore}/10</div>
            </div>
          </div>

          <p className="text-gray-300 text-sm leading-relaxed">{analysis.summary}</p>

          {risks.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase mb-2">Risks</div>
              <ul className="space-y-1">
                {risks.map((r, i) => (
                  <li key={i} className="text-sm text-red-300 flex gap-2">
                    <span className="text-red-500 shrink-0">•</span> {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Call Assistant */}
      <div className="bg-gray-900 rounded-lg border border-blue-900 p-5 space-y-4">
        <h2 className="font-semibold text-white flex items-center gap-2">
          📞 Call Prep Assistant
          {callNotes?.calledAt && (
            <span className="text-xs text-gray-500 font-normal">Last call: {new Date(callNotes.calledAt).toLocaleDateString()}</span>
          )}
        </h2>

        {/* Negotiation targets */}
        {analysis && (
          <div className="bg-blue-950 border border-blue-800 rounded p-3 text-sm space-y-1">
            <div className="text-blue-300 font-medium">Before you call:</div>
            <div className="text-gray-300">• Target offer: <span className="text-green-400 font-medium">{eur(analysis.suggestedOffer)}</span></div>
            <div className="text-gray-300">• Walk away if above: <span className="text-red-400 font-medium">{eur(analysis.fairPriceMax)}</span></div>
            <div className="text-gray-300">• Start negotiation at: <span className="text-yellow-400 font-medium">{eur(analysis.suggestedOffer ? analysis.suggestedOffer - 50000 : null)}</span></div>
          </div>
        )}

        {/* Question checklist */}
        {questions.length > 0 && (
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase mb-2">Questions to ask</div>
            <ul className="space-y-2">
              {questions.map((q, i) => (
                <li key={i} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={checked.includes(i)}
                    onChange={() => toggleCheck(i)}
                    className="mt-0.5 accent-blue-500"
                  />
                  <span className={`text-sm ${checked.includes(i) ? 'line-through text-gray-500' : 'text-gray-300'}`}>
                    {q}
                  </span>
                </li>
              ))}
              {/* Always include auction sheet question */}
              {!questions.some((q) => q.toLowerCase().includes('auction')) && (
                <li className="flex items-start gap-2">
                  <input type="checkbox" checked={checked.includes(99)} onChange={() => toggleCheck(99)} className="mt-0.5 accent-blue-500" />
                  <span className={`text-sm ${checked.includes(99) ? 'line-through text-gray-500' : 'text-gray-300'}`}>
                    Do you have the Japanese auction sheet? What was the grade?
                  </span>
                </li>
              )}
              <li className="flex items-start gap-2">
                <input type="checkbox" checked={checked.includes(98)} onChange={() => toggleCheck(98)} className="mt-0.5 accent-blue-500" />
                <span className={`text-sm ${checked.includes(98) ? 'line-through text-gray-500' : 'text-gray-300'}`}>
                  What is the exact trim level? (G, X, Z, GR Sport...)
                </span>
              </li>
            </ul>
          </div>
        )}

        {/* Notes */}
        <div>
          <div className="text-xs font-medium text-gray-500 uppercase mb-2">Call notes</div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What did they say? Condition details, negotiation room, impression..."
            rows={4}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-600 resize-none"
          />
        </div>

        {/* Outcome */}
        <div className="flex gap-3 items-center">
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white flex-1"
          >
            {OUTCOMES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <button
            onClick={() => saveNotes.mutate()}
            disabled={saveNotes.isPending}
            className="px-4 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-sm rounded transition-colors shrink-0"
          >
            {saveNotes.isPending ? 'Saving...' : 'Save notes'}
          </button>
        </div>

        {saveNotes.isSuccess && (
          <div className="text-green-400 text-xs">✓ Saved</div>
        )}
      </div>

      {/* Description */}
      {listing.description && (
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-5">
          <h2 className="font-semibold text-white mb-2 text-sm">Description</h2>
          <p className="text-gray-400 text-sm leading-relaxed whitespace-pre-line">{listing.description}</p>
        </div>
      )}
    </div>
  );
}
