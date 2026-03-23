'use client';

import { useState, useRef, useCallback } from 'react';

interface CommitteeAnalysis {
  domain: string;
  summary: string;
  benefits: string[];
  risks: string[];
  recommendations: string[];
  impactRating: string;
}

interface Deliberation {
  domain: string;
  initialAnalysis: CommitteeAnalysis;
  agreements: string[];
  counterArguments: string[];
  revisedRecommendations: string[];
  revisedImpactRating: string;
}

interface HistoryEntry {
  id: string;
  title: string;
  timestamp: Date;
  deliberated: boolean;
  report: string;
  committees: CommitteeAnalysis[];
  deliberations: Deliberation[];
}

const COMMITTEES = [
  { id: 'fiscal', icon: '📊', name: 'Fiscal & Economic Policy' },
  { id: 'health', icon: '🏥', name: 'Public Health & Human Services' },
  { id: 'defense', icon: '🛡️', name: 'National Security & Defense' },
  { id: 'tech', icon: '💻', name: 'Technology & Innovation' },
  { id: 'civil', icon: '⚖️', name: 'Civil Rights & Social Impact' },
  { id: 'env', icon: '🌿', name: 'Environmental & Energy' },
] as const;

type Stage = 'idle' | 'fetching' | 'fetched' | 'analyzing' | 'deliberating' | 'synthesizing' | 'done' | 'error';

const RATING_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'HIGHLY POSITIVE': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  POSITIVE: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
  NEUTRAL: { bg: 'bg-zinc-50', text: 'text-zinc-600', border: 'border-zinc-200' },
  NEGATIVE: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
  'HIGHLY NEGATIVE': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
};

function renderMarkdown(md: string): string {
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^---+$/gm, '<hr>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

  html = html
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('<')) return line;
      return `<p>${line}</p>`;
    })
    .join('\n');

  html = html.replace(/(<p>\|.+\|<\/p>\n?)+/g, match => {
    const rows = match
      .replace(/<\/?p>/g, '')
      .trim()
      .split('\n')
      .filter(r => r.trim() && !r.match(/^\|\s*[-:]+/));
    if (rows.length === 0) return match;
    let table = '<table>';
    rows.forEach((row, i) => {
      const cells = row.split('|').filter(c => c.trim());
      const tag = i === 0 ? 'th' : 'td';
      table += '<tr>' + cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('') + '</tr>';
    });
    table += '</table>';
    return table;
  });

  return html;
}

function CommitteeCard({
  committee,
  analysis,
  deliberation,
  isActive,
  isDone,
}: {
  committee: (typeof COMMITTEES)[number];
  analysis?: CommitteeAnalysis;
  deliberation?: Deliberation;
  isActive: boolean;
  isDone: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'analysis' | 'deliberation'>('analysis');
  const ratingStyle = analysis ? RATING_COLORS[analysis.impactRating] || RATING_COLORS.NEUTRAL : null;
  const ratingChanged = deliberation && deliberation.revisedImpactRating !== analysis?.impactRating;
  const revisedRatingStyle = deliberation ? RATING_COLORS[deliberation.revisedImpactRating] || RATING_COLORS.NEUTRAL : null;

  return (
    <div
      className={`bg-white border border-cream-dark relative overflow-hidden transition-shadow ${
        isActive ? 'animate-subtle-pulse' : ''
      }`}
    >
      {/* Top accent bar */}
      <div
        className={`absolute top-0 left-0 right-0 h-[3px] transition-colors duration-500 ${
          isDone ? 'bg-emerald-500' : isActive ? 'bg-gold' : 'bg-cream-dark'
        }`}
      />

      {/* Card header — clickable when done */}
      <button
        type="button"
        disabled={!isDone || !analysis}
        onClick={() => setOpen(prev => !prev)}
        className={`w-full text-left p-4 ${isDone && analysis ? 'cursor-pointer hover:bg-cream/50 transition-colors' : ''}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="text-xl mb-1">{committee.icon}</div>
            <div className="text-[0.7rem] font-medium uppercase tracking-wide leading-snug">
              {committee.name}
            </div>
            <div
              className={`text-[0.65rem] mt-1.5 ${
                isDone ? 'text-emerald-600' : isActive ? 'text-gold-dim' : 'text-zinc-400'
              }`}
            >
              {isDone ? 'Complete' : isActive ? 'Analyzing...' : 'Waiting...'}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {isActive && (
              <div className="w-3 h-3 border-[1.5px] border-cream-dark border-t-gold rounded-full animate-spin" />
            )}
            {isDone && analysis && ratingStyle && (
              <div className="flex flex-col items-end gap-0.5">
                <span
                  className={`text-[0.6rem] font-medium px-1.5 py-0.5 border ${ratingStyle.bg} ${ratingStyle.text} ${ratingStyle.border} ${ratingChanged ? 'line-through opacity-50' : ''}`}
                >
                  {analysis.impactRating}
                </span>
                {ratingChanged && revisedRatingStyle && (
                  <span
                    className={`text-[0.6rem] font-medium px-1.5 py-0.5 border ${revisedRatingStyle.bg} ${revisedRatingStyle.text} ${revisedRatingStyle.border}`}
                  >
                    {deliberation.revisedImpactRating}
                  </span>
                )}
              </div>
            )}
            {isDone && analysis && (
              <svg
                className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </div>
        </div>
      </button>

      {/* Accordion body */}
      {open && analysis && (
        <div className="border-t border-cream-dark px-4 pb-4 pt-3 animate-fade-up text-[0.8rem] leading-relaxed space-y-3">
          {/* Tab switcher when deliberation exists */}
          {deliberation && (
            <div className="flex gap-1 mb-3">
              <button
                type="button"
                onClick={() => setTab('analysis')}
                className={`text-[0.65rem] font-medium uppercase tracking-wider px-2.5 py-1 border transition-colors ${
                  tab === 'analysis'
                    ? 'bg-navy text-cream border-navy'
                    : 'bg-white text-zinc-500 border-cream-dark hover:border-zinc-400'
                }`}
              >
                Initial Analysis
              </button>
              <button
                type="button"
                onClick={() => setTab('deliberation')}
                className={`text-[0.65rem] font-medium uppercase tracking-wider px-2.5 py-1 border transition-colors ${
                  tab === 'deliberation'
                    ? 'bg-navy text-cream border-navy'
                    : 'bg-white text-zinc-500 border-cream-dark hover:border-zinc-400'
                }`}
              >
                Deliberation
              </button>
            </div>
          )}

          {tab === 'analysis' && (
            <>
              <p className="text-zinc-600">{analysis.summary}</p>

              <div>
                <h4 className="text-[0.65rem] font-medium uppercase tracking-wider text-emerald-600 mb-1">
                  Benefits
                </h4>
                <ul className="space-y-0.5 text-zinc-700">
                  {analysis.benefits.map((b, i) => (
                    <li key={i} className="flex gap-1.5">
                      <span className="text-emerald-500 flex-shrink-0">+</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-[0.65rem] font-medium uppercase tracking-wider text-red-500 mb-1">
                  Risks & Concerns
                </h4>
                <ul className="space-y-0.5 text-zinc-700">
                  {analysis.risks.map((r, i) => (
                    <li key={i} className="flex gap-1.5">
                      <span className="text-red-400 flex-shrink-0">&minus;</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-[0.65rem] font-medium uppercase tracking-wider text-blue-500 mb-1">
                  Recommendations
                </h4>
                <ul className="space-y-0.5 text-zinc-700">
                  {analysis.recommendations.map((r, i) => (
                    <li key={i} className="flex gap-1.5">
                      <span className="text-blue-400 flex-shrink-0">&rarr;</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {tab === 'deliberation' && deliberation && (
            <>
              <div>
                <h4 className="text-[0.65rem] font-medium uppercase tracking-wider text-emerald-600 mb-1">
                  Agreements with Other Committees
                </h4>
                <ul className="space-y-0.5 text-zinc-700">
                  {deliberation.agreements.map((a, i) => (
                    <li key={i} className="flex gap-1.5">
                      <span className="text-emerald-500 flex-shrink-0">&#10003;</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-[0.65rem] font-medium uppercase tracking-wider text-amber-600 mb-1">
                  Counter-Arguments
                </h4>
                <ul className="space-y-0.5 text-zinc-700">
                  {deliberation.counterArguments.map((c, i) => (
                    <li key={i} className="flex gap-1.5">
                      <span className="text-amber-500 flex-shrink-0">&#9998;</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-[0.65rem] font-medium uppercase tracking-wider text-blue-500 mb-1">
                  Revised Recommendations
                </h4>
                <ul className="space-y-0.5 text-zinc-700">
                  {deliberation.revisedRecommendations.map((r, i) => (
                    <li key={i} className="flex gap-1.5">
                      <span className="text-blue-400 flex-shrink-0">&rarr;</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {ratingChanged && (
                <div className="mt-2 text-[0.7rem] text-zinc-500 italic">
                  Rating changed from {analysis.impactRating} to {deliberation.revisedImpactRating} after deliberation
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function HistoryPanel({
  history,
  activeId,
  onSelect,
}: {
  history: HistoryEntry[];
  activeId: string | null;
  onSelect: (entry: HistoryEntry) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (history.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="font-serif text-xl mb-1">Analysis History</h2>
      <p className="text-sm text-zinc-400 mb-4">
        Click a title to view results. Expand to see agent calls.
      </p>
      <div className="space-y-2">
        {history.map(entry => {
          const isExpanded = expandedId === entry.id;
          const isActive = activeId === entry.id;
          const stepCount = entry.committees.length + entry.deliberations.length + 1;

          return (
            <div
              key={entry.id}
              className={`bg-white border transition-colors ${isActive ? 'border-gold' : 'border-cream-dark'}`}
            >
              {/* Top-level row */}
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Expand toggle */}
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-zinc-400 hover:text-zinc-600"
                >
                  <svg
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Title — click to load */}
                <button
                  type="button"
                  onClick={() => onSelect(entry)}
                  className="flex-1 text-left hover:text-navy transition-colors"
                >
                  <div className="text-sm font-medium leading-snug truncate">{entry.title}</div>
                  <div className="text-[0.65rem] text-zinc-400 mt-0.5">
                    {entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {' \u00b7 '}
                    {stepCount} agent calls
                    {entry.deliberated && ' \u00b7 with deliberation'}
                  </div>
                </button>
              </div>

              {/* Expanded: nested agent calls */}
              {isExpanded && (
                <div className="border-t border-cream-dark px-4 py-3 space-y-1.5 bg-cream/30">
                  {/* Committee reviews */}
                  {entry.committees.map((c, i) => {
                    const rating = RATING_COLORS[c.impactRating] || RATING_COLORS.NEUTRAL;
                    return (
                      <div key={`review-${i}`} className="flex items-center gap-2 text-[0.7rem]">
                        <span className="w-4 text-center text-zinc-300">{COMMITTEES[i]?.icon}</span>
                        <span className="text-zinc-500 w-12 flex-shrink-0 font-mono">review</span>
                        <span className="flex-1 truncate text-zinc-700">{c.domain}</span>
                        <span
                          className={`text-[0.6rem] font-medium px-1.5 py-0.5 border ${rating.bg} ${rating.text} ${rating.border}`}
                        >
                          {c.impactRating}
                        </span>
                      </div>
                    );
                  })}

                  {/* Deliberation calls */}
                  {entry.deliberations.map((d, i) => {
                    const rating = RATING_COLORS[d.revisedImpactRating] || RATING_COLORS.NEUTRAL;
                    const changed = d.revisedImpactRating !== entry.committees[i]?.impactRating;
                    return (
                      <div key={`delib-${i}`} className="flex items-center gap-2 text-[0.7rem]">
                        <span className="w-4 text-center text-zinc-300">{COMMITTEES[i]?.icon}</span>
                        <span className="text-amber-500 w-12 flex-shrink-0 font-mono">delib</span>
                        <span className="flex-1 truncate text-zinc-700">{d.domain}</span>
                        <span
                          className={`text-[0.6rem] font-medium px-1.5 py-0.5 border ${rating.bg} ${rating.text} ${rating.border}`}
                        >
                          {d.revisedImpactRating}
                          {changed && ' *'}
                        </span>
                      </div>
                    );
                  })}

                  {/* Synthesis */}
                  <div className="flex items-center gap-2 text-[0.7rem]">
                    <span className="w-4 text-center text-zinc-300">📋</span>
                    <span className="text-navy w-12 flex-shrink-0 font-mono font-medium">synth</span>
                    <span className="flex-1 truncate text-zinc-700">CRS Synthesizer</span>
                    <span className="text-[0.6rem] text-emerald-600 font-medium">done</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function looksLikeUrl(input: string): boolean {
  const trimmed = input.trim();
  return /^https?:\/\//i.test(trimmed) && !trimmed.includes('\n');
}

export default function Page() {
  const [input, setInput] = useState('');
  const [stage, setStage] = useState<Stage>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [docTitle, setDocTitle] = useState('');
  const [report, setReport] = useState('');
  const [committees, setCommittees] = useState<CommitteeAnalysis[]>([]);
  const [deliberations, setDeliberations] = useState<Deliberation[]>([]);
  const [deliberate, setDeliberate] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const loadHistoryEntry = useCallback((entry: HistoryEntry) => {
    setStage('done');
    setDocTitle(entry.title);
    setReport(entry.report);
    setCommittees(entry.committees);
    setDeliberations(entry.deliberations);
    setDeliberate(entry.deliberated);
    setActiveHistoryId(entry.id);
    setError('');
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, []);

  const analyze = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) {
      setError('Please enter a URL or paste legislation text.');
      return;
    }

    const isUrl = looksLikeUrl(trimmed);

    setError('');
    setStage('fetching');
    setStatusMessage(isUrl ? 'Fetching document from URL...' : 'Preparing document...');
    setReport('');
    setDocTitle('');
    setCommittees([]);
    setDeliberations([]);
    setActiveHistoryId(null);

    try {
      const body = isUrl
        ? { url: trimmed, deliberate }
        : { text: trimmed, deliberate };

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok && !response.headers.get('content-type')?.includes('text/event-stream')) {
        const err = await response.json();
        throw new Error(err.error || 'Request failed');
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let resultTitle = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const event of events) {
          const match = event.match(/^event: (\w+)\ndata: (.+)$/s);
          if (!match) continue;

          const [, eventType, dataStr] = match;
          const data = JSON.parse(dataStr);

          if (eventType === 'status') {
            setStage(data.stage as Stage);
            setStatusMessage(data.message);
            if (data.title) {
              setDocTitle(data.title);
              resultTitle = data.title;
            }
          } else if (eventType === 'result') {
            const resultCommittees = data.committees || [];
            const resultDeliberations = data.deliberations || [];
            if (data.title) resultTitle = data.title;

            setStage('done');
            setReport(data.report);
            setCommittees(resultCommittees);
            setDeliberations(resultDeliberations);
            if (data.title) setDocTitle(data.title);

            // Add to history
            const entry: HistoryEntry = {
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              title: resultTitle || 'Untitled',
              timestamp: new Date(),
              deliberated: deliberate,
              report: data.report,
              committees: resultCommittees,
              deliberations: resultDeliberations,
            };
            setHistory(prev => [entry, ...prev]);
            setActiveHistoryId(entry.id);

            setTimeout(() => {
              resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
          } else if (eventType === 'error') {
            throw new Error(data.message);
          }
        }
      }
    } catch (err) {
      setStage('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, [input, deliberate]);

  const startNew = () => {
    setStage('idle');
    setInput('');
    setReport('');
    setDocTitle('');
    setError('');
    setStatusMessage('');
    setCommittees([]);
    setDeliberations([]);
    setActiveHistoryId(null);
  };

  const isLoading = stage === 'fetching' || stage === 'fetched' || stage === 'analyzing' || stage === 'deliberating' || stage === 'synthesizing';
  const showCommittees = isLoading || stage === 'done';

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-navy text-cream relative overflow-hidden">
        <div className="max-w-[960px] mx-auto px-6 py-8 flex items-center gap-5">
          <div className="w-16 h-16 border-2 border-gold rounded-full flex items-center justify-center flex-shrink-0 relative">
            <div className="absolute inset-[3px] border border-gold/20 rounded-full" />
            <svg viewBox="0 0 24 24" className="w-7 h-7 fill-gold">
              <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18L19.39 8 12 11.82 4.61 8 12 4.18zM4 9.09l7 3.5v7.32l-7-3.5V9.09zm10 10.82V12.6l7-3.5v7.31l-7 3.5z" />
            </svg>
          </div>
          <div>
            <h1 className="font-serif text-[1.75rem] leading-tight">Legislative Council</h1>
            <p className="text-gold text-xs uppercase tracking-[0.15em] mt-1 font-medium">
              Multi-Agent Policy Analysis System
            </p>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-gold via-gold-dim to-gold" />
      </header>

      <main className="max-w-[960px] mx-auto px-6 py-10">
        {/* Document Input */}
        <div className="bg-white border border-cream-dark p-6 mb-8 relative">
          <span className="absolute -top-2.5 left-5 bg-white px-2 text-[0.65rem] tracking-[0.2em] text-zinc-400 font-medium">
            DOCUMENT SUBMISSION
          </span>
          <div className="flex gap-3">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey && looksLikeUrl(input)) {
                  e.preventDefault();
                  analyze();
                }
              }}
              placeholder="Paste a URL or the full text of legislation..."
              disabled={isLoading}
              rows={looksLikeUrl(input) || !input ? 1 : 6}
              className="flex-1 font-mono text-sm px-4 py-3 border-[1.5px] border-cream-dark bg-cream text-zinc-800 outline-none focus:border-gold transition-colors placeholder:font-sans placeholder:text-zinc-400 disabled:opacity-50 resize-y"
            />
            <button
              onClick={analyze}
              disabled={isLoading}
              className="font-sans text-xs font-medium tracking-[0.1em] uppercase bg-navy text-cream px-7 py-3 hover:bg-navy-mid transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap self-start"
            >
              {isLoading ? 'Analyzing...' : 'Analyze'}
            </button>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-zinc-400 italic">
              Paste a URL to fetch a document, or paste legislation text directly.
            </p>
            <label className="flex items-center gap-2 cursor-pointer select-none flex-shrink-0 ml-4">
              <input
                type="checkbox"
                checked={deliberate}
                onChange={e => setDeliberate(e.target.checked)}
                disabled={isLoading}
                className="w-3.5 h-3.5 accent-navy cursor-pointer disabled:opacity-50"
              />
              <span className="text-xs text-zinc-600 font-medium">Deliberation</span>
            </label>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 text-sm mb-6">{error}</div>
        )}

        {/* History */}
        <HistoryPanel history={history} activeId={activeHistoryId} onSelect={loadHistoryEntry} />

        {/* Committee Progress */}
        {showCommittees && (
          <div className="mb-8">
            <h2 className="font-serif text-xl mb-1">
              {stage === 'done' ? 'Committee Reports' : 'Committees in Session'}
            </h2>
            <p className="text-sm text-zinc-400 mb-5">
              {stage === 'done'
                ? 'Click any committee card to expand its individual report.'
                : statusMessage}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {COMMITTEES.map((c, i) => (
                <CommitteeCard
                  key={c.id}
                  committee={c}
                  analysis={committees[i]}
                  deliberation={deliberations[i]}
                  isActive={stage === 'analyzing' || stage === 'deliberating'}
                  isDone={stage === 'done'}
                />
              ))}
            </div>

            {/* Deliberation bar — only shown when deliberation is enabled */}
            {deliberate && (
              <div
                className={`mt-3 bg-amber-50 border border-amber-200 text-zinc-800 px-4 py-3.5 flex items-center gap-3 transition-opacity duration-500 ${
                  stage === 'analyzing' || stage === 'deliberating' || stage === 'done' ? 'opacity-100' : 'opacity-30'
                } ${stage === 'analyzing' ? 'animate-subtle-pulse' : ''}`}
              >
                <div className="text-xl">💬</div>
                <div>
                  <div className="text-[0.7rem] font-medium uppercase tracking-wide">
                    Committee Deliberation
                  </div>
                  <div className="text-[0.65rem] mt-0.5 text-amber-700">
                    {stage === 'done'
                      ? 'Deliberation complete'
                      : stage === 'analyzing'
                        ? 'Committees reviewing each others findings...'
                        : 'Waiting for initial analyses...'}
                  </div>
                </div>
                {stage === 'analyzing' && (
                  <div className="ml-auto w-3 h-3 border-[1.5px] border-amber-200 border-t-amber-600 rounded-full animate-spin" />
                )}
              </div>
            )}

            {/* Synthesizer bar */}
            <div
              className={`mt-3 bg-navy text-cream px-4 py-3.5 flex items-center gap-3 transition-opacity duration-500 ${
                stage === 'analyzing' || stage === 'done' ? 'opacity-100' : 'opacity-30'
              } ${stage === 'analyzing' ? 'animate-subtle-pulse' : ''}`}
            >
              <div className="text-xl">📋</div>
              <div>
                <div className="text-[0.7rem] font-medium uppercase tracking-wide text-cream">
                  CRS Synthesizer
                </div>
                <div className="text-[0.65rem] mt-0.5 text-gold">
                  {stage === 'done'
                    ? 'Report finalized'
                    : stage === 'analyzing'
                      ? deliberate
                        ? 'Compiling analyses and deliberation...'
                        : 'Compiling committee reports...'
                      : deliberate
                        ? 'Waiting for deliberation...'
                        : 'Waiting for committee reports...'}
                </div>
              </div>
              {stage === 'analyzing' && (
                <div className="ml-auto w-3 h-3 border-[1.5px] border-cream/30 border-t-gold rounded-full animate-spin" />
              )}
            </div>
          </div>
        )}

        {/* Results */}
        {stage === 'done' && report && (
          <div ref={resultsRef} className="animate-fade-up">
            <div className="flex items-baseline justify-between border-b-2 border-navy pb-3 mb-6">
              <h2 className="font-serif text-2xl">Unified Legislative Analysis</h2>
              {docTitle && (
                <span className="text-xs text-zinc-400 italic max-w-[40%] text-right truncate">
                  {docTitle}
                </span>
              )}
            </div>

            <div className="bg-white border border-cream-dark p-8 relative">
              {/* Left accent bar */}
              <div className="absolute top-0 left-0 bottom-0 w-1 bg-gradient-to-b from-gold to-navy" />
              <div
                className="report-content text-[0.925rem] leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(report) }}
              />
            </div>

            <button
              onClick={startNew}
              className="mt-6 text-xs font-medium tracking-[0.1em] uppercase text-navy border-[1.5px] border-navy px-6 py-2.5 hover:bg-navy hover:text-cream transition-colors"
            >
              New Analysis
            </button>
          </div>
        )}
      </main>

      <footer className="max-w-[960px] mx-auto px-6 pb-10 text-center text-[0.7rem] text-zinc-400 tracking-wide">
        Powered by Mastra Council Pattern &mdash; Multi-agent parallel analysis with synthesis
      </footer>
    </div>
  );
}
