import { ArrowUpRight } from 'lucide-react';
import { useMemo } from 'react';
import { Badge } from '../../../ds/components/Badge';
import { Button } from '../../../ds/components/Button';
import { stringToColor } from '../../../lib/colors';
import { TopicsLayout } from '../../topics';
import { signals } from '../signals-data';
import type { Signal, SignalFacet } from '../types';

interface SignalFacetCardProps {
  facet: SignalFacet;
  totalTraceCount: number;
}

const getTraceShare = (traceCount: number, totalTraceCount: number) => {
  if (totalTraceCount === 0) return 0;

  return Math.round((traceCount / totalTraceCount) * 100);
};

export function SignalFacetCard({ facet, totalTraceCount }: SignalFacetCardProps) {
  const traceCount = facet.traceSummaries.length;
  const traceShare = getTraceShare(traceCount, totalTraceCount);
  const traceLabel = traceCount === 1 ? 'trace' : 'traces';
  const facetColor = stringToColor(facet.name);

  return (
    <article className="rounded-2xl border border-border1/70 bg-surface2 p-5 shadow-sm">
      <div className="flex h-full min-w-0 flex-col">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: facetColor }} />

          <div>
            <h3 className="text-md font-semibold text-neutral6">{facet.name}</h3>
            <p className="line-clamp-2 text-sm text-neutral3">{facet.description}</p>
          </div>
        </div>

        <div className="space-y-1 pt-4 pl-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs uppercase text-neutral3">Trace share</p>
            <p className="font-mono text-xs text-neutral3">
              {traceCount} {traceLabel}
            </p>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_4rem] items-center gap-4">
            <div
              className="h-3 overflow-hidden rounded-full bg-surface4"
              role="progressbar"
              aria-label={`${facet.name} trace share`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={traceShare}
            >
              <div className="h-full rounded-full" style={{ width: `${traceShare}%`, backgroundColor: facetColor }} />
            </div>
            <p className="text-right text-ui-md font-semibold text-neutral6">{traceShare}%</p>
          </div>
        </div>
      </div>
    </article>
  );
}

interface SignalSectionProps {
  signal: Signal;
  onSeeDetails: (signal: Signal) => void;
}

export function SignalSection({ signal, onSeeDetails }: SignalSectionProps) {
  const totalTraceCount = useMemo(
    () => signal.facets.reduce((total, facet) => total + facet.traceSummaries.length, 0),
    [signal.facets],
  );

  return (
    <section className="space-y-4">
      <header className="flex items-start justify-between gap-6 px-1">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h2 className="text-ui-2xl font-semibold text-neutral6">{signal.name}</h2>
            <Badge variant="default">
              {signal.facets.length} {signal.facets.length === 1 ? 'facet' : 'facets'}
            </Badge>
          </div>
          <p className="text-ui-lg text-neutral3">{signal.description}</p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="lg"
          className="shrink-0 gap-2 rounded-xl px-5"
          onClick={() => onSeeDetails(signal)}
        >
          See details
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </header>
      <div className="grid gap-6 md:grid-cols-2">
        {signal.facets.map(facet => (
          <SignalFacetCard key={facet.id} facet={facet} totalTraceCount={totalTraceCount} />
        ))}
      </div>
    </section>
  );
}

export interface SignalsOverviewPageProps {
  onSignalSelect: (signal: Signal) => void;
}

export function SignalsOverviewPage({ onSignalSelect }: SignalsOverviewPageProps) {
  return (
    <TopicsLayout sidebar={null} contentPadding={false}>
      <nav className="h-full min-w-0 overflow-y-auto p-6" aria-label="Signals">
        <div className="mx-auto flex max-w-6xl flex-col gap-12">
          {signals.map(signal => (
            <SignalSection key={signal.id} signal={signal} onSeeDetails={onSignalSelect} />
          ))}
        </div>
      </nav>
    </TopicsLayout>
  );
}
