import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type PhotoAnalysis } from '../api/client.ts';
import { RiskBadge, RecBadge, StatusBadge, eur } from '../components/Badge.tsx';
import { useToast } from '../components/Toast.tsx';

const OUTCOMES = [
  { value: '', label: 'Select outcome...' },
  { value: 'interested', label: 'Interested' },
  { value: 'too_expensive', label: 'Too expensive (negotiating)' },
  { value: 'not_responding', label: 'Not responding' },
  { value: 'rejected', label: 'Rejected' },
];

const card = 'bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm p-5';
const btn = 'px-3 py-1.5 text-xs rounded transition-colors cursor-pointer disabled:opacity-50';

function PriceSparkline({ history }: { history: Array<{ newPrice: number; changedAt: string }> }) {
  const W = 120, H = 36, PAD = 4;
  const prices = history.map((h) => h.newPrice);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const pts = prices.map((p, i) => {
    const x = PAD + (i / (prices.length - 1)) * (W - PAD * 2);
    const y = PAD + ((max - p) / range) * (H - PAD * 2);
    return `${x},${y}`;
  });
  const down = prices[prices.length - 1] < prices[0];
  const color = down ? '#22c55e' : '#ef4444';
  return (
    <div className="mt-1" title={history.map(h => `${new Date(h.changedAt).toLocaleDateString()}: €${h.newPrice / 100}`).join(' → ')}>
      <svg width={W} height={H} className="overflow-visible">
        <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
        {prices.map((_, i) => {
          const [x, y] = pts[i].split(',').map(Number);
          return <circle key={i} cx={x} cy={y} r="2.5" fill={color} />;
        })}
      </svg>
      <div className="text-xs text-gray-400 mt-0.5">{history.length} price points</div>
    </div>
  );
}

function AuctionSheetCard({ sheet }: { sheet: NonNullable<PhotoAnalysis['auctionSheet']> }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-amber-50 dark:bg-amber-950 border border-amber-300 dark:border-amber-800 rounded-lg p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-amber-800 dark:text-amber-300 text-sm">Auction Sheet</h2>
        <button onClick={() => setExpanded(!expanded)} className="text-xs text-amber-600 dark:text-amber-400 cursor-pointer hover:underline">
          {expanded ? 'Collapse' : 'Show raw text'}
        </button>
      </div>

      {/* Key fields */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {Object.entries(sheet.fields).map(([key, val]) => (
          <div key={key} className="bg-white/60 dark:bg-gray-900/60 rounded px-3 py-2">
            <div className="text-xs text-gray-400 capitalize">{key}</div>
            <div className="text-sm font-medium">{val}</div>
          </div>
        ))}
      </div>

      {/* Damage marks */}
      {sheet.damageMarks.length > 0 && (
        <div>
          <div className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">Damage marks</div>
          <ul className="space-y-0.5">
            {sheet.damageMarks.map((m, i) => (
              <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex gap-2">
                <span className="shrink-0 text-amber-500">-</span> {m}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Red flags */}
      {sheet.redFlags.length > 0 && (
        <div>
          <div className="text-xs font-medium text-red-600 mb-1">Red flags</div>
          <ul className="space-y-0.5">
            {sheet.redFlags.map((f, i) => (
              <li key={i} className="text-sm text-red-600 dark:text-red-400 flex gap-2">
                <span className="shrink-0">!</span> {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Raw text */}
      {expanded && sheet.rawText && (
        <pre className="text-xs text-gray-600 dark:text-gray-400 bg-white/40 dark:bg-gray-900/40 rounded p-3 whitespace-pre-wrap overflow-x-auto max-h-64 overflow-y-auto">
          {sheet.rawText}
        </pre>
      )}
    </div>
  );
}

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const numId = Number(id);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [notes, setNotes] = useState('');
  const [checked, setChecked] = useState<number[]>([]);
  const [outcome, setOutcome] = useState('');
  const [sellerInput, setSellerInput] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['listing', id],
    queryFn: () => api.listing(numId),
  });

  // Load cached photo analysis from DB
  const { data: photoAnalysis } = useQuery({
    queryKey: ['photoAnalysis', id],
    queryFn: () => api.photoAnalysis(numId),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (data?.callNotes) {
      setNotes(data.callNotes.notes ?? '');
      setChecked(data.callNotes.checkedQuestions ?? []);
      setOutcome(data.callNotes.outcome ?? '');
    }
  }, [data?.callNotes]);

  const saveNotes = useMutation({
    mutationFn: () => api.saveCallNotes(numId, { notes, checkedQuestions: checked, outcome: outcome || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['listing', id] });
      toast('Notes saved', 'success');
    },
    onError: (err) => toast(`Failed to save: ${err.message}`, 'error'),
  });

  const analyze = useMutation({
    mutationFn: () => api.analyze(numId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['listing', id] });
      toast('Analysis complete', 'success');
    },
    onError: (err) => toast(`Analysis failed: ${err.message}`, 'error'),
  });

  const analyzePhotos = useMutation({
    mutationFn: (force?: boolean) => api.analyzePhotos(numId, force),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['photoAnalysis', id] });
      toast('Photo analysis complete', 'success');
    },
    onError: (err) => toast(`Photo analysis failed: ${err.message}`, 'error'),
  });

  const generateWa = useMutation({
    mutationFn: () => api.generateWhatsApp(numId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['listing', id] });
      toast('WhatsApp message generated', 'success');
    },
    onError: (err) => toast(`Failed: ${err.message}`, 'error'),
  });

  const replyMut = useMutation({
    mutationFn: (sellerMessage: string) => api.reply(numId, sellerMessage),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['listing', id] });
      setSellerInput('');
      toast('Reply generated', 'success');
    },
    onError: (err) => toast(`Failed: ${err.message}`, 'error'),
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => api.updateStatus(numId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['listing', id] });
      toast('Status updated', 'success');
    },
    onError: (err) => toast(`Failed: ${err.message}`, 'error'),
  });

  if (isLoading) return <div className="text-gray-400 py-12 text-center">Loading...</div>;
  if (!data) return <div className="text-red-500 py-12 text-center">Not found</div>;

  const { listing, analysis, callNotes, priceHistory, conversations } = data;
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
            {priceHistory.length >= 2 && <PriceSparkline history={priceHistory} />}
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
            {generateWa.isPending ? 'Generating...' : 'WhatsApp'}
          </button>
          {listing.imageUrls?.length > 0 && (
            <button onClick={() => analyzePhotos.mutate(!!photoAnalysis)} disabled={analyzePhotos.isPending}
              className={`${btn} bg-purple-100 dark:bg-purple-900 hover:bg-purple-200 dark:hover:bg-purple-800 text-purple-800 dark:text-purple-200`}>
              {analyzePhotos.isPending ? 'Analyzing...' : photoAnalysis ? `Re-analyze photos (${listing.imageUrls.length})` : `Analyze photos (${listing.imageUrls.length})`}
            </button>
          )}
          {!analysis && (
            <button onClick={() => analyze.mutate()} disabled={analyze.isPending}
              className={`${btn} bg-blue-100 dark:bg-blue-900 hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-800 dark:text-blue-200`}>
              {analyze.isPending ? 'Analyzing...' : 'Analyze'}
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

      {/* Chat */}
      {conversations.length > 0 && (
        <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-5 space-y-3">
          <h2 className="font-semibold text-green-700 dark:text-green-300 text-sm">Chat</h2>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {conversations.map((msg) => (
              <div key={msg.id} className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  msg.direction === 'outgoing'
                    ? 'bg-green-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700'
                }`}>
                  <p className="whitespace-pre-line">{msg.message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs ${msg.direction === 'outgoing' ? 'text-green-200' : 'text-gray-400'}`}>
                      {new Date(msg.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.direction === 'outgoing' && (
                      <button
                        onClick={() => { navigator.clipboard.writeText(msg.message); toast('Copied', 'success'); }}
                        className={`text-xs ${msg.direction === 'outgoing' ? 'text-green-200 hover:text-white' : 'text-gray-400 hover:text-gray-600'} cursor-pointer`}
                      >copy</button>
                    )}
                    {msg.whatsappLink && (
                      <a href={msg.whatsappLink} target="_blank" rel="noreferrer"
                        className="text-xs text-green-200 hover:text-white cursor-pointer">wa ↗</a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Reply input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={sellerInput}
              onChange={(e) => setSellerInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && sellerInput.trim() && !replyMut.isPending) replyMut.mutate(sellerInput); }}
              placeholder="Paste seller's reply..."
              className="flex-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
            <button
              onClick={() => replyMut.mutate(sellerInput)}
              disabled={!sellerInput.trim() || replyMut.isPending}
              className={`${btn} bg-green-600 hover:bg-green-500 text-white shrink-0`}
            >
              {replyMut.isPending ? 'Thinking...' : 'Get reply'}
            </button>
          </div>
        </div>
      )}

      {/* Auction Sheet — separate prominent card */}
      {photoAnalysis?.auctionSheet && (
        <AuctionSheetCard sheet={photoAnalysis.auctionSheet} />
      )}

      {/* Photo analysis */}
      {photoAnalysis && (
        <div className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-purple-700 dark:text-purple-300 text-sm">Photo Analysis</h2>
            {photoAnalysis.analyzedAt && (
              <span className="text-xs text-gray-400">{new Date(photoAnalysis.analyzedAt).toLocaleDateString()}</span>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { val: photoAnalysis.overallCondition, label: 'Condition', good: ['excellent', 'good'], bad: ['poor'] },
              { val: photoAnalysis.accidentSuspicion, label: 'Accident signs', good: ['none'], bad: ['medium', 'high'] },
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
              <div className="text-xs font-medium text-red-500 mb-1.5">Issues</div>
              <ul className="space-y-1">
                {photoAnalysis.issues.map((issue, i) => (
                  <li key={i} className="text-sm text-red-600 dark:text-red-300 flex gap-2">
                    <span className="shrink-0">-</span> {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {photoAnalysis.positives.length > 0 && (
            <div>
              <div className="text-xs font-medium text-green-600 dark:text-green-400 mb-1.5">Positives</div>
              <ul className="space-y-1">
                {photoAnalysis.positives.map((p, i) => (
                  <li key={i} className="text-sm text-green-700 dark:text-green-300 flex gap-2">
                    <span className="shrink-0">+</span> {p}
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
                    <span className="shrink-0 text-red-400">-</span> {r}
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
          Call Prep
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
