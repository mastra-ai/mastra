import { useTraceSpans } from '@mastra/react/hooks/traces';
import { ArrowUpRight } from 'lucide-react';
import { useMemo } from 'react';

import { useExpandedSpanIds } from '../hooks/use-expanded-span-ids';
import { formatHierarchicalSpans } from './format-hierarchical-spans';
import { TraceSpanTree } from './trace-span-tree';
import { Txt } from '@/ds/components/Txt/Txt';
import { useLinkComponent } from '@/lib/framework';
import { cn } from '@/lib/utils';
import { formatDurationPrecise } from '@/utils/duration';

const POLL_MS = 2000;
const MAX_POLLS = 30;

type SpanTiming = { parentSpanId?: string | null; endedAt?: Date | string | null };

function isRunRecorded(spans: SpanTiming[] | undefined) {
  return Boolean(spans?.some(span => !span.parentSpanId && span.endedAt));
}

/** The spans of the run that produced a message, set flat under that message. Polls until the run is recorded. */
export function MessageTrace({ traceId, className }: { traceId: string; className?: string }) {
  const { Link, paths, navigate } = useLinkComponent();
  const { data, isLoading, isError } = useTraceSpans({
    traceId,
    queryOptions: {
      refetchInterval: query =>
        isRunRecorded(query.state.data?.spans) ||
        query.state.dataUpdateCount + query.state.errorUpdateCount >= MAX_POLLS
          ? false
          : POLL_MS,
    },
  });
  const hierarchicalSpans = useMemo(() => formatHierarchicalSpans(data?.spans ?? []), [data]);
  const { expandedSpanIds, setExpandedSpanIds } = useExpandedSpanIds(hierarchicalSpans);
  const rootLatency = hierarchicalSpans[0]?.latency;
  const traceHref = paths.traceLink(traceId);

  return (
    <section aria-label="Trace" data-testid="message-trace" className={cn('min-w-0', className)}>
      <div className="flex items-center gap-2 pb-1">
        <Txt as="span" variant="caption" tone="muted">
          Trace{rootLatency !== undefined && ` · ${formatDurationPrecise(rootLatency)}`}
        </Txt>
        {traceHref && (
          <Link
            href={traceHref}
            className="text-ui-sm flex items-center gap-0.5 text-muted-foreground hover:text-foreground"
          >
            Open trace
            <ArrowUpRight className="size-3.5" />
          </Link>
        )}
      </div>
      {isError && hierarchicalSpans.length === 0 ? (
        <Txt variant="caption" tone="muted">
          This run’s spans are not recorded yet.
        </Txt>
      ) : (
        <TraceSpanTree
          hierarchicalSpans={hierarchicalSpans}
          isLoading={isLoading || hierarchicalSpans.length === 0}
          withLegend={false}
          expandedSpanIds={expandedSpanIds}
          setExpandedSpanIds={setExpandedSpanIds}
          onSpanClick={spanId => traceHref && navigate(paths.traceLink(traceId, spanId))}
        />
      )}
    </section>
  );
}
