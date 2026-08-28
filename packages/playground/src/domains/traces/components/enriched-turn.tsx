import { ExternalLinkIcon } from 'lucide-react';

import type { TimelineSpan } from '../lib/build-thread-timeline';
import { TraceInvestigate, TraceTurn } from './trace-investigate';
import { TraceScoresCollapsible } from './trace-scores-collapsible';
import { useLinkComponent } from '@/lib/framework';

export type EnrichedTurnProps = {
  traceId: string;
  /** The trace's root span: scores are recorded against it. */
  spanId: string;
  /** Already resolved spans, when the caller has them. Otherwise the turn fetches its own. */
  spans?: TimelineSpan[];
  /** Agent scorers only make sense on the top level span of an agent run. */
  isTopLevelSpan?: boolean;
  entityType?: string;
  /** Estimated cost of the turn, already formatted. Hidden when unknown. */
  cost?: string;
};

/**
 * One turn of a conversation, read from its trace: the trace itself as a way out, the
 * rebuilt exchange, and its scores. The single rendering of a turn, so the agent chat
 * and the trace panel's thread tab never drift apart.
 *
 * The turn only draws its own boundary on hover: the reading surface stays flat, but
 * pointing at a turn shows how far it reaches.
 */
export function EnrichedTurn({ traceId, spanId, spans, isTopLevelSpan, entityType, cost }: EnrichedTurnProps) {
  const { Link, navigate } = useLinkComponent();

  return (
    <section className="group/trace hover:border-border1 hover:bg-surface2 duration-normal rounded-xl border border-dashed border-transparent px-5 py-4 transition-colors">
      <div className="text-neutral3 text-ui-sm flex h-5 items-center justify-end gap-1.5 font-mono opacity-0 transition-opacity group-hover/trace:opacity-100 focus-within:opacity-100">
        <Link
          href={`/traces?traceId=${encodeURIComponent(traceId)}`}
          target="_blank"
          rel="noreferrer"
          className="hover:text-neutral6 duration-normal inline-flex items-center gap-1.5 transition-colors"
        >
          Trace #{traceId.slice(0, 8)}
          <ExternalLinkIcon className="size-3" />
        </Link>

        {cost && (
          <>
            <span aria-hidden className="bg-neutral3 size-1 rounded-full" />
            <span data-testid="trace-cost">{cost}</span>
          </>
        )}
      </div>

      {spans ? <TraceTurn traceId={traceId} spans={spans} /> : <TraceInvestigate traceId={traceId} />}

      <TraceScoresCollapsible
        traceId={traceId}
        spanId={spanId}
        isTopLevelSpan={isTopLevelSpan}
        entityType={entityType}
        // Neither surface refetches scores, so a queued run is only visible on the trace page.
        onScoringStarted={() => navigate(`/traces?traceId=${encodeURIComponent(traceId)}&traceTab=scores`)}
      />
    </section>
  );
}
