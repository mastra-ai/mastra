import type { LightSpanRecord } from '@mastra/core/storage';
import { ExternalLinkIcon } from 'lucide-react';

import { TraceInvestigate } from './trace-investigate';
import { TraceScoresCollapsible } from './trace-scores-collapsible';
import { useLinkComponent } from '@/lib/framework';

export type EnrichedThreadProps = {
  /** The thread's traces, oldest first. */
  traces: LightSpanRecord[];
};

/**
 * The conversation rebuilt from its traces: one turn per trace, in the chat's own
 * centred column so switching modes keeps the reading position.
 *
 * Each turn only draws its own boundary on hover: the reading surface stays flat,
 * but pointing at a turn shows how far it reaches and offers its trace as a way out.
 */
export function EnrichedThread({ traces }: EnrichedThreadProps) {
  const { Link } = useLinkComponent();

  return (
    <div className="h-full overflow-y-auto">
      <div data-testid="enriched-thread" className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
        {traces.map(trace => (
          <section
            key={trace.traceId}
            className="group/trace hover:border-border1 hover:bg-surface2 duration-normal rounded-xl border border-dashed border-transparent px-5 py-4 transition-colors"
          >
            <div className="flex h-5 items-center justify-end">
              <Link
                href={`/traces?traceId=${encodeURIComponent(trace.traceId)}`}
                target="_blank"
                rel="noreferrer"
                className="text-neutral3 hover:text-neutral6 duration-normal text-ui-sm inline-flex items-center gap-1.5 font-mono opacity-0 transition-opacity group-hover/trace:opacity-100 focus-visible:opacity-100"
              >
                Trace #{trace.traceId.slice(0, 8)}
                <ExternalLinkIcon className="size-3" />
              </Link>
            </div>

            <TraceInvestigate traceId={trace.traceId} />
            <TraceScoresCollapsible traceId={trace.traceId} spanId={trace.spanId} />
          </section>
        ))}
      </div>
    </div>
  );
}
