import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.ts';
import { RiskBadge, RecBadge, StatusBadge, eur } from '../components/Badge.tsx';
import { useToast } from '../components/Toast.tsx';

const OUTCOMES = [
  { value: '', label: 'Select outcome...' },
  { value: 'interested', label: '✅ Interested' },
  { value: 'too_expensive', label: '💬 Too expensive (negotiating)' },
  { value: 'not_responding', label: '📵 Not responding' },
  { value: 'rejected', label: '❌ Rejected' },
];

const card = 'bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm p-5';
const btn = 'px-3 py-1.5 text-xs rounded transition-colors cursor-pointer disabled:opacity-50';

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [waMessage, setWaMessage] = useState<{ message: string; waLink: string | null } | null>(null);
  const [photoAnalysis, setPhotoAnalysis] = useState<{ overallCondition: string; issues: string[]; positives: string[]; accidentSuspicion: string; summary: string } | null>(null);
  const [notes, setNotes] = useState('');
  const [checked, setChecked] = useState<number[]>([]);
  const [outcome, setOutcome] = useState('');
  const [notesLoaded, setNotesLoaded] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['listing', id],
    queryFn: () => api.listing(Number(id)),
  });

  if (data?.callNotes && !notesLoaded) {
    setNotes(data.callNotes.notes ?? '');
    setChecked(data.callNotes.checkedQuestions ?? []);
    setOutcome(data.callNotes.outcome ?? '');
    setNotesLoaded(true);
  }

  const saveNotes = useMutation({
    mutationFn: () => api.saveCallNotes(Number(id), { notes, checkedQuestions: checked, outcome: outcome || undefined }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['listing', id] }),
  });

  const analyze = useMutation({
    mutationFn: () => api.analyze(Number(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['listing', id] }),
  });

  const analyzePhotos = useMutation({
    mutationFn: () => api.analyzePhotos(Number(id)),
    onSuccess: (data) => setPhotoAnalysis(data),
    onError: (err) => toast(`Photo analysis failed: ${err.message}`, 'error'),
  });

  const generateWa = useMutation({
    mutationFn: () => api.generateWhatsApp(Number(id)),
    onSuccess: (data) => { setWaMessage(data); qc.invalidateQueries({ queryKey: ['listing', id] }); },
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => api.updateStatus(Number(id), status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['listing', id] }),
  });

  if (isLoading) return <div className="text-gray-400 py-12 text-center">Loading...</div>;
  if (!data) return <div className="text-red-500 py-12 text-center">Not found</div>;

  const { listing, analysis, callNotes } = data;
  const questions = analysis?.questionsForSeller ?? [];
  const risks = analysis?.risks ?? [];

  const toggleCheck = (i: number) =>
    setChecked((prev) => prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]);

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Link to="/listings" className="hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer">← Listings</Link>
        <span>/</span>
        <span>#{listing.id}</span>
      </div>

      {/* Header card */}
      <div className={card}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold">{listing.title}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <StatusBadge status={listing.status} />
              {analysis && <RiskBadge score={analysis.riskScore} />}
              {analysis && <RecBadge rec={analysis.recommendation} />}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-bold">{eur(listing.price)}</div>
            {analysis?.suggestedOffer && (
              <div className="text-sm text-green-600 dark:text-green-400">Offer: {eur(analysis.suggestedOffer)}</div>
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
            <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded p-2">
              <div className="text-xs text-gray-400">{label}</div>
              <div className="font-medium text-sm">{val}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-4 flex-wrap">
          <a href={listing.url} target="_blank" rel="noreferrer"
            className={`${btn} bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600`}>
            Open Bazaraki ↗
          </a>
          <button onClick={() => generateWa.mutate()} disabled={generateWa.isPending}
            className={`${btn} bg-green-100 dark:bg-green-800 hover:bg-green-200 dark:hover:bg-green-700 text-green-800 dark:text-green-200`}>
            {generateWa.isPending ? '✍️ Генерю...' : '💬 WhatsApp message'}
          </button>
          {listing.imageUrls?.length > 0 && (
            <button onClick={() => analyzePhotos.mutate()} disabled={analyzePhotos.isPending}
              className={`${btn} bg-purple-100 dark:bg-purple-900 hover:bg-purple-200 dark:hover:bg-purple-800 text-purple-800 dark:text-purple-200`}>
              {analyzePhotos.isPending ? '🔍 Анализирую...' : `🖼 Фото (${listing.imageUrls.length})`}
            </button>
          )}
          {!analysis && (
            <button onClick={() => analyze.mutate()} disabled={analyze.isPending}
              className={`${btn} bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-800 dark:text-blue-200`}>
              {analyze.isPending ? 'Analyzing...' : '🤖 Analyze'}
            </button>
          )}
          <select value={listing.status} onChange={(e) => updateStatus.mutate(e.target.value)}
            className="ml-auto bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 text-xs cursor-pointer">
            {['new', 'analyzed', 'contacted', 'negotiating', 'rejected', 'bought'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* WhatsApp message */}
      {waMessage && (
        <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-green-700 dark:text-green-300 text-sm">💬 Готовое сообщение</h2>
            <button onClick={() => setWaMessage(null)} className="text-gray-400 hover:text-gray-600 text-xs cursor-pointer">✕</button>
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-line bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded p-3">
            {waMessage.message}
          </p>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => navigator.clipboard.writeText(waMessage.message)}
              className={`${btn} bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600`}>
              📋 Скопировать
            </button>
            {waMessage.waLink ? (
              <a href={waMessage.waLink} target="_blank" rel="noreferrer"
                className={`${btn} bg-green-600 hover:bg-green-500 text-white`}>
                Открыть WhatsApp ↗
              </a>
            ) : (
              <span className="text-xs text-gray-400 self-center">Нет номера — скопируй вручную</span>
            )}
          </div>
        </div>
      )}

      {/* Photo analysis */}
      {photoAnalysis && (
        <div className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-purple-700 dark:text-purple-300 text-sm">🖼 Анализ фотографий</h2>
            <button onClick={() => setPhotoAnalysis(null)} className="text-gray-400 hover:text-gray-600 text-xs cursor-pointer">✕</button>
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { val: photoAnalysis.overallCondition, label: 'Состояние', good: ['excellent', 'good'], bad: ['poor'] },
              { val: photoAnalysis.accidentSuspicion, label: 'Признаки ДТП', good: ['none'], bad: ['medium', 'high'] },
            ].map(({ val, label, good, bad }) => (
              <div key={label} className={`px-3 py-1.5 rounded text-xs font-medium ${
                good.includes(val) ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' :
                bad.includes(val) ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300' :
                'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'
              }`}>{label}: {val}</div>
            ))}
          </div>
          <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">{photoAnalysis.summary}</p>
          {photoAnalysis.issues.length > 0 && (
            <div>
              <div className="text-xs font-medium text-red-500 mb-1.5">Проблемы</div>
              <ul className="space-y-1">
                {photoAnalysis.issues.map((issue, i) => (
                  <li key={i} className="text-sm text-red-600 dark:text-red-300 flex gap-2">
                    <span className="shrink-0">•</span> {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {photoAnalysis.positives.length > 0 && (
            <div>
              <div className="text-xs font-medium text-green-600 dark:text-green-400 mb-1.5">Хорошее</div>
              <ul className="space-y-1">
                {photoAnalysis.positives.map((p, i) => (
                  <li key={i} className="text-sm text-green-700 dark:text-green-300 flex gap-2">
                    <span className="shrink-0">✓</span> {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* AI Analysis */}
      {analysis && (
        <div className={card + ' space-y-4'}>
          <h2 className="font-semibold text-sm">AI Analysis</h2>
          <div className="grid grid-cols-3 gap-3 text-sm">
            {[
              { label: 'Fair value', val: `${eur(analysis.fairPriceMin)} – ${eur(analysis.fairPriceMax)}` },
              { label: 'Overprice', val: `${analysis.overpricePercent > 0 ? '+' : ''}${analysis.overpricePercent}%`,
                cls: analysis.overpricePercent > 0 ? 'text-red-500' : 'text-green-500' },
              { label: 'Risk score', val: `${analysis.riskScore}/10` },
            ].map(({ label, val, cls }) => (
              <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded p-3">
                <div className="text-xs text-gray-400">{label}</div>
                <div className={`font-medium ${cls ?? ''}`}>{val}</div>
              </div>
            ))}
          </div>
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">{analysis.summary}</p>
          {risks.length > 0 && (
            <div>
              <div className="text-xs font-medium text-gray-400 uppercase mb-2">Risks</div>
              <ul className="space-y-1">
                {risks.map((r, i) => (
                  <li key={i} className="text-sm text-red-600 dark:text-red-300 flex gap-2">
                    <span className="shrink-0 text-red-400">•</span> {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Call Assistant */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-blue-200 dark:border-blue-900 shadow-sm p-5 space-y-4">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          📞 Call Prep
          {callNotes?.calledAt && (
            <span className="text-xs text-gray-400 font-normal">Last: {new Date(callNotes.calledAt).toLocaleDateString()}</span>
          )}
        </h2>

        {analysis && (
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded p-3 text-sm space-y-1">
            <div className="text-blue-700 dark:text-blue-300 font-medium text-xs uppercase">Before you call</div>
            <div className="text-gray-600 dark:text-gray-300">Target: <span className="text-green-600 dark:text-green-400 font-medium">{eur(analysis.suggestedOffer)}</span></div>
            <div className="text-gray-600 dark:text-gray-300">Walk away above: <span className="text-red-500 font-medium">{eur(analysis.fairPriceMax)}</span></div>
          </div>
        )}

        {questions.length > 0 && (
          <div>
            <div className="text-xs font-medium text-gray-400 uppercase mb-2">Checklist</div>
            <ul className="space-y-2">
              {[...questions,
                'Do you have the Japanese auction sheet? What was the grade?',
                'What is the exact trim level? (G, X, Z, GR Sport...)'
              ].map((q, i) => (
                <li key={i} className="flex items-start gap-2">
                  <input type="checkbox" checked={checked.includes(i)} onChange={() => toggleCheck(i)}
                    className="mt-0.5 accent-blue-500 cursor-pointer" />
                  <span className={`text-sm ${checked.includes(i) ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>{q}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Call notes: what did they say, condition, negotiation room..."
          rows={4}
          className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />

        <div className="flex gap-3 items-center">
          <select value={outcome} onChange={(e) => setOutcome(e.target.value)}
            className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-3 py-1.5 text-sm flex-1 cursor-pointer">
            {OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button onClick={() => saveNotes.mutate()} disabled={saveNotes.isPending}
            className={`${btn} bg-blue-600 hover:bg-blue-500 text-white shrink-0`}>
            {saveNotes.isPending ? 'Saving...' : 'Save notes'}
          </button>
        </div>
        {saveNotes.isSuccess && <div className="text-green-500 text-xs">✓ Saved</div>}
      </div>

      {/* Description */}
      {listing.description && (
        <div className={card}>
          <h2 className="font-semibold text-sm mb-2">Description</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed whitespace-pre-line">{listing.description}</p>
        </div>
      )}
    </div>
  );
}
