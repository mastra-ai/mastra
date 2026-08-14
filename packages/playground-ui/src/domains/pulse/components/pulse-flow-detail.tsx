import type { FlowDetail, FlowTreeNode } from '@mastra/core/storage';
import { CircleSlash2, MousePointerClick } from 'lucide-react';
import { PulseStatusBadge } from './shared';
import { formatCost } from '@/domains/metrics/components/metrics-utils';
import { isPulseUnavailableError, usePulseFlow, usePulseFlowTimeline } from '@/domains/pulse/hooks/use-pulse-flows';
import { formatClockTime, formatFlowDuration, toDate } from '@/domains/pulse/utils/format';
import { EmptyState } from '@/ds/components/EmptyState';
import { Skeleton } from '@/ds/components/Skeleton';
import { cn } from '@/lib/utils';

const INDENT_PX = 16;

/** Capture-lane tint for timeline source badges, using the same accent token
 *  pairs the DS StatusBadge uses. Lanes without a dedicated accent (log, drop,
 *  unknown) fall back to the neutral treatment. */
const LANE_BADGE_CLASSES: Record<string, string> = {
  span: 'bg-accent5Dark text-accent5',
  session: 'bg-accent1Dark text-accent1',
  runtime: 'bg-accent6Dark text-accent6',
  metric: 'bg-accent3Dark text-accent3',
  score: 'bg-accent2Dark text-accent2',
  feedback: 'bg-surface5 text-neutral5',
};

const NEUTRAL_LANE_CLASSES = 'bg-surface4 text-neutral4';

/** Depth = number of parent hops until a root. Nodes whose parent is missing
 *  from the tree (or that sit on a malformed cycle) count as roots. */
function getNodeDepth(node: FlowTreeNode, bySpanId: Map<string, FlowTreeNode>): number {
  let depth = 0;
  const visited = new Set<string>([node.spanId]);
  let current = node;
  while (current.parentSpanId) {
    const parent = bySpanId.get(current.parentSpanId);
    if (!parent || visited.has(parent.spanId)) break;
    visited.add(parent.spanId);
    depth += 1;
    current = parent;
  }
  return depth;
}

/** The flow window every duration bar is proportional to: from the earliest
 *  span start to the latest known end (open spans contribute their start). */
function getFlowWindow(flow: FlowDetail): { startMs: number; spanMs: number } {
  const startTimes = flow.tree.map(node => toDate(node.startedAt).getTime());
  const endTimes = flow.tree.map(node =>
    node.endedAt ? toDate(node.endedAt).getTime() : toDate(node.startedAt).getTime(),
  );
  const startMs = Math.min(toDate(flow.startedAt).getTime(), ...startTimes);
  const endMs = Math.max(startMs + (flow.durationMs ?? 0), ...endTimes);
  return { startMs, spanMs: Math.max(1, endMs - startMs) };
}

function PulseFlowTree({ flow }: { flow: FlowDetail }) {
  const bySpanId = new Map(flow.tree.map(node => [node.spanId, node]));
  const { startMs, spanMs } = getFlowWindow(flow);

  return (
    <div className="flex flex-col gap-px" data-testid="pulse-flow-tree">
      {flow.tree.map(node => {
        const depth = getNodeDepth(node, bySpanId);
        const nodeStart = toDate(node.startedAt).getTime();
        const nodeEnd = node.endedAt ? toDate(node.endedAt).getTime() : nodeStart;
        const leftPct = ((nodeStart - startMs) / spanMs) * 100;
        const widthPct = Math.max(1, ((nodeEnd - nodeStart) / spanMs) * 100);
        // Red marks a span that errored OR never closed — both are anomalies in
        // a settled flow and exactly what this prototype view is for spotting.
        const isAnomalous = node.hasError || !node.endedAt;

        return (
          <div
            key={node.spanId}
            className="grid grid-cols-[minmax(10rem,1fr)_minmax(8rem,2fr)_max-content] items-center gap-3 py-0.5"
          >
            <span
              className="text-ui-sm text-neutral5 min-w-0 truncate"
              style={{ paddingLeft: depth * INDENT_PX }}
              title={node.spanId}
            >
              {node.label}
            </span>
            <span className="bg-surface3 relative h-2 overflow-hidden rounded-full">
              <span
                className={cn('absolute inset-y-0 rounded-full', isAnomalous ? 'bg-accent2' : 'bg-accent5')}
                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
              />
            </span>
            <span className="text-ui-xs text-neutral3 flex items-center gap-1.5 tabular-nums">
              {formatFlowDuration(node.durationMs)}
              {isAnomalous && (
                <span
                  role="img"
                  aria-label={node.hasError ? 'Span has error' : 'Span never ended'}
                  className="bg-accent2 size-1.5 rounded-full"
                />
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export type PulseFlowDetailProps = {
  /** Flow to inspect; `null`/`undefined` renders the "select a flow" placeholder. */
  flowId: string | null | undefined;
};

/**
 * Detail pane for one derived flow: summary chips, the span tree as indented
 * rows with duration bars proportional to the flow window, the referenced
 * definitions, and the full pulse timeline across capture lanes.
 */
export function PulseFlowDetail({ flowId }: PulseFlowDetailProps) {
  const flowQuery = usePulseFlow(flowId ?? undefined);
  const flow = flowQuery.data?.flow ?? null;
  const timelineQuery = usePulseFlowTimeline(flowId ?? undefined, flow?.status === 'running');

  if (!flowId) {
    return (
      <EmptyState
        iconSlot={<MousePointerClick className="text-neutral3 size-8" />}
        titleSlot="Select a flow"
        descriptionSlot="Pick a flow from the list to inspect its span tree and pulse timeline."
      />
    );
  }

  if (flowQuery.isLoading) {
    return (
      <div className="flex flex-col gap-2 p-4" data-testid="pulse-flow-detail-loading">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (flowQuery.isError) {
    if (isPulseUnavailableError(flowQuery.error)) {
      return (
        <EmptyState
          iconSlot={<CircleSlash2 className="text-neutral3 size-8" />}
          titleSlot="Pulse is not available"
          descriptionSlot="The server has no pulse store configured, so this flow cannot be derived."
        />
      );
    }
    return (
      <EmptyState
        iconSlot={<CircleSlash2 className="text-neutral3 size-8" />}
        titleSlot="Could not load flow"
        descriptionSlot={flowQuery.error instanceof Error ? flowQuery.error.message : 'An unexpected error occurred.'}
      />
    );
  }

  if (!flow) {
    return (
      <EmptyState
        iconSlot={<CircleSlash2 className="text-neutral3 size-8" />}
        titleSlot="Flow not found"
        descriptionSlot="No pulse rows exist for this flow id."
      />
    );
  }

  const timeline = timelineQuery.data?.timeline ?? [];

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex items-center gap-3">
        <PulseStatusBadge status={flow.status} />
        <span className="text-ui-md text-neutral6 font-medium">{flow.entityName ?? flow.flowId}</span>
        <span className="text-ui-xs text-neutral3 tabular-nums">{formatFlowDuration(flow.durationMs)}</span>
        {flow.costUsd !== undefined && (
          <span className="text-ui-xs text-neutral3 tabular-nums">{formatCost(flow.costUsd)}</span>
        )}
      </div>

      <PulseFlowTree flow={flow} />

      {flow.definitions.length > 0 && (
        <div className="text-ui-xs text-neutral3">
          <span className="text-neutral5 font-medium">Definitions:</span> {flow.definitions.join(', ')}
        </div>
      )}

      <div className="flex flex-col gap-px" data-testid="pulse-flow-timeline">
        {timeline.map(entry => (
          <div
            key={`${toDate(entry.timestamp).getTime()}-${entry.seq}`}
            className="grid grid-cols-[max-content_max-content_minmax(0,1fr)_max-content] items-center gap-3 py-0.5"
          >
            <span className="text-ui-xs text-neutral3 tabular-nums">{formatClockTime(entry.timestamp)}</span>
            <span
              className={cn(
                'inline-flex w-fit items-center rounded-full px-1.5 py-0.5 text-ui-xs font-medium',
                LANE_BADGE_CLASSES[entry.source] ?? NEUTRAL_LANE_CLASSES,
              )}
            >
              {entry.source}
            </span>
            <span className="text-ui-sm text-neutral5 min-w-0 truncate">
              {entry.surface}.{entry.action}
            </span>
            {entry.runId && <span className="text-ui-xs text-neutral3 truncate">{entry.runId}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
