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
  const color = down ? 'var(--c-green)' : 'var(--c-red)';
  return (
    <div className="mt-1" title={history.map(h => `${new Date(h.changedAt).toLocaleDateString()}: €${h.newPrice / 100}`).join(' → ')}>
      <svg width={W} height={H} className="overflow-visible">
        <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
        {prices.map((_, i) => {
          const [x, y] = pts[i].split(',').map(Number);
          return <circle key={i} cx={x} cy={y} r="2.5" fill={color} />;
        })}
      </svg>
      <div className="text-xs mt-0.5" style={{ color: 'var(--c-muted)' }}>{history.length} price points</div>
    </div>
  );
}

function AuctionSheetCard({ sheet }: { sheet: NonNullable<PhotoAnalysis['auctionSheet']> }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-lg p-5 space-y-3" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)' }}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-sm" style={{ color: 'var(--c-accent)' }}>Auction Sheet</h2>
        <button onClick={() => setExpanded(!expanded)} className="text-xs cursor-pointer hover:underline" style={{ color: 'rgba(245,158,11,0.7)' }}>
          {expanded ? 'Collapse' : 'Show raw text'}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {Object.entries(sheet.fields).map(([key, val]) => (
          <div key={key} className="rounded px-3 py-2" style={{ background: 'var(--c-surface)' }}>
            <div className="text-xs capitalize" style={{ color: 'var(--c-muted)' }}>{key}</div>
            <div className="text-sm font-medium mt-0.5" style={{ color: 'var(--c-text)' }}>{val}</div>
          </div>
        ))}
      </div>

      {sheet.damageMarks.length > 0 && (
        <div>
          <div className="text-xs font-medium mb-1.5" style={{ color: 'rgba(245,158,11,0.8)' }}>Damage marks</div>
          <ul className="space-y-1">
            {sheet.damageMarks.map((m, i) => (
              <li key={i} className="text-sm flex gap-2" style={{ color: 'var(--c-text)' }}>
                <span style={{ color: 'var(--c-accent)' }}>–</span> {m}
              </li>
            ))}
          </ul>
        </div>
      )}

      {sheet.redFlags.length > 0 && (
        <div>
          <div className="text-xs font-medium mb-1.5" style={{ color: 'var(--c-red)' }}>Red flags</div>
          <ul className="space-y-1">
            {sheet.redFlags.map((f, i) => (
              <li key={i} className="text-sm flex gap-2" style={{ color: 'var(--c-red)' }}>
                <span>!</span> {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {expanded && sheet.rawText && (
        <pre className="text-xs rounded p-3 whitespace-pre-wrap overflow-x-auto max-h-64 overflow-y-auto"
          style={{ background: 'var(--c-surface)', color: 'var(--c-muted)' }}>
          {sheet.rawText}
        </pre>
      )}
    </div>
  );
}

const btn = 'px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer disabled:opacity-50';

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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['listing', id] }); toast('Notes saved', 'success'); },
    onError: (err) => toast(`Failed to save: ${err.message}`, 'error'),
  });

  const analyze = useMutation({
    mutationFn: () => api.analyze(numId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['listing', id] }); toast('Analysis complete', 'success'); },
    onError: (err) => toast(`Analysis failed: ${err.message}`, 'error'),
  });

  const analyzePhotos = useMutation({
    mutationFn: (force?: boolean) => api.analyzePhotos(numId, force),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['photoAnalysis', id] }); toast('Photo analysis complete', 'success'); },
    onError: (err) => toast(`Photo analysis failed: ${err.message}`, 'error'),
  });

  const generateWa = useMutation({
    mutationFn: () => api.generateWhatsApp(numId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['listing', id] }); toast('WhatsApp message generated', 'success'); },
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['listing', id] }); toast('Status updated', 'success'); },
    onError: (err) => toast(`Failed: ${err.message}`, 'error'),
  });

  if (isLoading) return (
    <div className="flex items-center justify-center py-20 text-sm" style={{ color: 'var(--c-muted)' }}>Loading...</div>
  );
  if (!data) return (
    <div className="flex items-center justify-center py-20 text-sm" style={{ color: 'var(--c-red)' }}>Not found</div>
  );

  const { listing, analysis, callNotes, priceHistory, conversations } = data;
  const questions = analysis?.questionsForSeller ?? [];
  const risks = analysis?.risks ?? [];

  const toggleCheck = (i: number) =>
    setChecked((prev) => prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]);

  const inputStyle = {
    background: 'var(--c-surface-hi)',
    border: '1px solid var(--c-border)',
    color: 'var(--c-text)',
  } as React.CSSProperties;

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--c-muted)' }}>
        <Link to="/listings" className="transition-colors hover:underline" style={{ color: 'var(--c-muted)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--c-text)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--c-muted)')}>
          ← Listings
        </Link>
        <span>/</span>
        <span>#{listing.id}</span>
      </div>

      {/* Header card */}
      <div className="card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-base font-semibold" style={{ color: 'var(--c-text)' }}>{listing.title}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <StatusBadge status={listing.status} />
              {analysis && <RiskBadge score={analysis.riskScore} />}
              {analysis && <RecBadge rec={analysis.recommendation} />}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="mono text-2xl font-bold" style={{ color: 'var(--c-text)' }}>{eur(listing.price)}</div>
            {analysis?.suggestedOffer && (
              <div className="mono text-sm font-medium mt-0.5" style={{ color: 'var(--c-green)' }}>
                Offer: {eur(analysis.suggestedOffer)}
              </div>
            )}
            {priceHistory.length >= 2 && <PriceSparkline history={priceHistory} />}
          </div>
        </div>

        {/* Specs grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
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
            <div key={label} className="rounded-md px-3 py-2" style={{ background: 'var(--c-surface-hi)' }}>
              <div className="text-xs" style={{ color: 'var(--c-muted)' }}>{label}</div>
              <div className="font-medium text-sm mt-0.5" style={{ color: 'var(--c-text)' }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-4 flex-wrap items-center">
          <a href={listing.url} target="_blank" rel="noreferrer"
            className={btn}
            style={{ background: 'var(--c-surface-hi)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}>
            Open Bazaraki ↗
          </a>
          <button onClick={() => generateWa.mutate()} disabled={generateWa.isPending}
            className={btn}
            style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', color: 'var(--c-green)' }}>
            {generateWa.isPending ? 'Generating...' : 'WhatsApp'}
          </button>
          {listing.imageUrls?.length > 0 && (
            <button onClick={() => analyzePhotos.mutate(!!photoAnalysis)} disabled={analyzePhotos.isPending}
              className={btn}
              style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.25)', color: 'var(--c-purple)' }}>
              {analyzePhotos.isPending ? 'Analyzing...' : photoAnalysis
                ? `Re-analyze photos (${listing.imageUrls.length})`
                : `Analyze photos (${listing.imageUrls.length})`}
            </button>
          )}
          {!analysis && (
            <button onClick={() => analyze.mutate()} disabled={analyze.isPending}
              className={btn}
              style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)', color: 'var(--c-blue)' }}>
              {analyze.isPending ? 'Analyzing...' : 'Analyze'}
            </button>
          )}
          <select value={listing.status} onChange={(e) => updateStatus.mutate(e.target.value)}
            className="ml-auto text-xs rounded-md px-2 py-1.5 cursor-pointer outline-none"
            style={inputStyle}>
            {['new', 'analyzed', 'liked', 'contacted', 'negotiating', 'rejected', 'bought'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Photos */}
      {listing.imageUrls?.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
          {listing.imageUrls.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noreferrer" className="shrink-0">
              <img
                src={url}
                alt={`photo ${i + 1}`}
                className="h-40 w-auto rounded-lg object-cover transition-opacity hover:opacity-85"
                style={{ border: '1px solid var(--c-border)' }}
              />
            </a>
          ))}
        </div>
      )}

      {/* Chat */}
      {conversations.length > 0 && (
        <div className="rounded-lg p-5 space-y-3"
          style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.2)' }}>
          <h2 className="font-semibold text-sm" style={{ color: 'var(--c-green)' }}>Chat</h2>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {conversations.map((msg) => (
              <div key={msg.id} className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${msg.direction === 'outgoing' ? '' : ''}`}
                  style={msg.direction === 'outgoing'
                    ? { background: 'var(--c-green)', color: '#0a1a10' }
                    : { background: 'var(--c-surface)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}>
                  <p className="whitespace-pre-line">{msg.message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs opacity-60">
                      {new Date(msg.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.direction === 'outgoing' && (
                      <button
                        onClick={() => { navigator.clipboard.writeText(msg.message); toast('Copied', 'success'); }}
                        className="text-xs opacity-60 hover:opacity-100 cursor-pointer"
                      >copy</button>
                    )}
                    {msg.whatsappLink && (
                      <a href={msg.whatsappLink} target="_blank" rel="noreferrer"
                        className="text-xs opacity-60 hover:opacity-100 cursor-pointer">wa ↗</a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={sellerInput}
              onChange={(e) => setSellerInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && sellerInput.trim() && !replyMut.isPending) replyMut.mutate(sellerInput); }}
              placeholder="Paste seller's reply..."
              className="flex-1 rounded-md px-3 py-2 text-sm outline-none"
              style={{ ...inputStyle, background: 'var(--c-surface)' }}
            />
            <button
              onClick={() => replyMut.mutate(sellerInput)}
              disabled={!sellerInput.trim() || replyMut.isPending}
              className={`${btn} shrink-0 text-white disabled:opacity-50`}
              style={{ background: 'var(--c-green)', color: '#0a1a10' }}>
              {replyMut.isPending ? 'Thinking...' : 'Get reply'}
            </button>
          </div>
        </div>
      )}

      {/* Auction Sheet */}
      {photoAnalysis?.auctionSheet && <AuctionSheetCard sheet={photoAnalysis.auctionSheet} />}

      {/* Photo analysis */}
      {photoAnalysis && (
        <div className="rounded-lg p-5 space-y-3"
          style={{ background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.2)' }}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm" style={{ color: 'var(--c-purple)' }}>Photo Analysis</h2>
            {photoAnalysis.analyzedAt && (
              <span className="text-xs" style={{ color: 'var(--c-muted)' }}>
                {new Date(photoAnalysis.analyzedAt).toLocaleDateString()}
              </span>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { val: photoAnalysis.overallCondition, label: 'Condition', good: ['excellent', 'good'], bad: ['poor'] },
              { val: photoAnalysis.accidentSuspicion, label: 'Accident signs', good: ['none'], bad: ['medium', 'high'] },
            ].map(({ val, label, good, bad }) => {
              const color = good.includes(val) ? 'var(--c-green)' : bad.includes(val) ? 'var(--c-red)' : 'var(--c-accent)';
              return (
                <div key={label} className="px-3 py-1.5 rounded text-xs font-medium"
                  style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
                  {label}: {val}
                </div>
              );
            })}
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--c-text)' }}>{photoAnalysis.summary}</p>
          {photoAnalysis.issues.length > 0 && (
            <div>
              <div className="text-xs font-medium mb-1.5" style={{ color: 'var(--c-red)' }}>Issues</div>
              <ul className="space-y-1">
                {photoAnalysis.issues.map((issue, i) => (
                  <li key={i} className="text-sm flex gap-2" style={{ color: 'var(--c-red)' }}>
                    <span className="shrink-0">–</span> {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {photoAnalysis.positives.length > 0 && (
            <div>
              <div className="text-xs font-medium mb-1.5" style={{ color: 'var(--c-green)' }}>Positives</div>
              <ul className="space-y-1">
                {photoAnalysis.positives.map((p, i) => (
                  <li key={i} className="text-sm flex gap-2" style={{ color: 'var(--c-green)' }}>
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
        <div className="card space-y-4">
          <h2 className="font-semibold text-sm" style={{ color: 'var(--c-text)' }}>AI Analysis</h2>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Fair value', val: `${eur(analysis.fairPriceMin)} – ${eur(analysis.fairPriceMax)}`, color: 'var(--c-text)', mono: true },
              { label: 'Overprice', val: `${analysis.overpricePercent > 0 ? '+' : ''}${analysis.overpricePercent}%`,
                color: analysis.overpricePercent > 0 ? 'var(--c-red)' : 'var(--c-green)', mono: true },
              { label: 'Risk score', val: `${analysis.riskScore}/10`, color: 'var(--c-text)', mono: true },
            ].map(({ label, val, color, mono }) => (
              <div key={label} className="rounded-md px-3 py-2.5" style={{ background: 'var(--c-surface-hi)' }}>
                <div className="text-xs" style={{ color: 'var(--c-muted)' }}>{label}</div>
                <div className={`font-semibold mt-0.5 ${mono ? 'mono' : ''}`} style={{ color }}>{val}</div>
              </div>
            ))}
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--c-muted)' }}>{analysis.summary}</p>
          {risks.length > 0 && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--c-muted)' }}>Risks</div>
              <ul className="space-y-1.5">
                {risks.map((r, i) => (
                  <li key={i} className="text-sm flex gap-2" style={{ color: 'var(--c-red)' }}>
                    <span className="shrink-0">–</span> {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Call Assistant */}
      <div className="card space-y-4" style={{ borderColor: 'rgba(96,165,250,0.25)' }}>
        <h2 className="font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--c-text)' }}>
          Call Prep
          {callNotes?.calledAt && (
            <span className="text-xs font-normal" style={{ color: 'var(--c-muted)' }}>
              Last: {new Date(callNotes.calledAt).toLocaleDateString()}
            </span>
          )}
        </h2>

        {analysis && (
          <div className="rounded-md p-3 text-sm space-y-1"
            style={{ background: 'rgba(96,165,250,0.07)', border: '1px solid rgba(96,165,250,0.2)' }}>
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--c-blue)' }}>Before you call</div>
            <div style={{ color: 'var(--c-muted)' }}>
              Target: <span className="mono font-semibold" style={{ color: 'var(--c-green)' }}>{eur(analysis.suggestedOffer)}</span>
            </div>
            <div style={{ color: 'var(--c-muted)' }}>
              Walk away above: <span className="mono font-semibold" style={{ color: 'var(--c-red)' }}>{eur(analysis.fairPriceMax)}</span>
            </div>
          </div>
        )}

        {questions.length > 0 && (
          <div>
            <div className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--c-muted)' }}>Checklist</div>
            <ul className="space-y-2">
              {[...questions,
                'Do you have the Japanese auction sheet? What was the grade?',
                'What is the exact trim level? (G, X, Z, GR Sport...)'
              ].map((q, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <input type="checkbox" checked={checked.includes(i)} onChange={() => toggleCheck(i)}
                    className="mt-0.5 cursor-pointer" style={{ accentColor: 'var(--c-blue)' }} />
                  <span className="text-sm" style={{ color: checked.includes(i) ? 'var(--c-muted)' : 'var(--c-text)', textDecoration: checked.includes(i) ? 'line-through' : 'none' }}>
                    {q}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Call notes: what did they say, condition, negotiation room..."
          rows={4}
          className="w-full rounded-md px-3 py-2 text-sm outline-none resize-none"
          style={{ ...inputStyle, background: 'var(--c-surface-hi)' }}
        />

        <div className="flex gap-3 items-center">
          <select value={outcome} onChange={(e) => setOutcome(e.target.value)}
            className="flex-1 text-sm rounded-md px-3 py-1.5 outline-none cursor-pointer"
            style={inputStyle}>
            {OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button
            onClick={() => saveNotes.mutate()}
            disabled={saveNotes.isPending}
            className={`${btn} shrink-0 text-white disabled:opacity-50`}
            style={{ background: 'var(--c-blue)' }}>
            {saveNotes.isPending ? 'Saving...' : 'Save notes'}
          </button>
        </div>
      </div>

      {/* Description */}
      {listing.description && (
        <div className="card">
          <h2 className="font-semibold text-sm mb-2" style={{ color: 'var(--c-text)' }}>Description</h2>
          <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: 'var(--c-muted)' }}>
            {listing.description}
          </p>
        </div>
      )}
    </div>
  );
}
