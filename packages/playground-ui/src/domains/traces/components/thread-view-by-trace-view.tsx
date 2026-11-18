import type { ReactNode } from 'react';
import type { SpanRecord, TraceSpanRecord } from '../types';
import type { RegisteredTools } from './span-payload/span-tools-section';
import { ThreadTrace, useThreadTrace, useThreadTraceRow } from '@/domains/traces/components/thread-trace';
import type { ThreadTraceSelectedSpan } from '@/domains/traces/components/thread-trace';
import { ThreadViewSkeleton } from '@/domains/traces/components/thread-view-skeleton';
import { TraceThreadItemView } from '@/domains/traces/components/trace-thread-item-view';
import { TracesErrorContent } from '@/domains/traces/components/traces-error-content';
import { Button } from '@/ds/components/Button';
import { Txt } from '@/ds/components/Txt';
import { IconChatBubble7 } from '@/ds/icons/central/IconChatBubble7';
import { IconChatBubble7Plus } from '@/ds/icons/central/IconChatBubble7Plus';
import { IconSquareArrowTopRight } from '@/ds/icons/central/IconSquareArrowTopRight';
import { Icon } from '@/ds/icons/Icon';
import { ScorersIcon } from '@/ds/icons/ScorersIcon';
import { useLinkComponent } from '@/lib/framework';

/** One turn of the thread: a trace and the spans its `getTrace` returned. */
export interface ThreadViewTrace {
  traceId: string;
  /** Every span of the trace with its payload; the turn's messages and span tree are drawn from them. */
  spans?: TraceSpanRecord[];
  /** The spans are still loading: the turn shows its skeletons. */
  isLoading: boolean;
  /** The spans failed to load. */
  error?: unknown;
}

export interface ThreadViewByTraceViewProps {
  /** The thread's turns in reading order (oldest first). */
  traces: ThreadViewTrace[];
  /** The thread is still loading: shows the thread skeleton. */
  isLoading?: boolean;
  /** The thread failed to load. */
  error?: unknown;
  /** Fires when the reader scrolls up to the oldest loaded turn; load the previous page here. */
  onLoadOlder?: () => void;
  /** Controlled span selection (`null`: none open), so the host can load the selected span's record. */
  selectedSpan?: ThreadTraceSelectedSpan | null;
  /** Fires when a span detail opens or closes (`null`). */
  onSelectedSpanChange?: (selected: ThreadTraceSelectedSpan | null) => void;
  /** Full record of the selected span (`getSpan`). */
  selectedSpanDetail?: SpanRecord;
  isLoadingSelectedSpanDetail?: boolean;
  /** The tool registry (`listTools`), so the tools a span offered link to their pages. */
  registeredTools?: RegisteredTools;
  /** Adds a Feedback tab to each turn, showing what this renders for the turn's trace. */
  feedbackSlot?: (args: { traceId: string }) => ReactNode;
  /** Adds a Scores tab to each turn, showing what this renders for the turn's root span. */
  scoresSlot?: (args: { traceId: string; rootSpanId: string }) => ReactNode;
}

/**
 * A memory thread rendered as its traces, like a chat: one row per agent turn (oldest at the top),
 * opened on the latest turns. Each row shows the reconstructed messages on the left and the span tree on
 * the right; clicking a span opens its detail on the side so the conversation stays readable.
 *
 * Data-agnostic: the turns, their spans, the selected span's record, feedback and scores all come from the
 * host, so Studio (`ThreadViewByTrace`) and other hosts draw the same view. Key it on the thread id so
 * the rows' expansion and highlights never leak into another thread.
 */
export function ThreadViewByTraceView({
  traces,
  isLoading,
  error,
  onLoadOlder,
  selectedSpan,
  onSelectedSpanChange,
  selectedSpanDetail,
  isLoadingSelectedSpanDetail,
  registeredTools,
  feedbackSlot,
  scoresSlot,
}: ThreadViewByTraceViewProps) {
  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <TracesErrorContent error={error} resource="traces" errorTitle="Failed to load traces" />
      </div>
    );
  }

  if (isLoading) return <ThreadViewSkeleton withFeedback={!!feedbackSlot} />;

  if (traces.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <Txt variant="body" tone="muted">
          No traces found for this thread.
        </Txt>
      </div>
    );
  }

  return (
    <ThreadTrace
      traceIds={traces.map(trace => trace.traceId)}
      selectedSpan={selectedSpan}
      onSelectedSpanChange={onSelectedSpanChange}
      onLoadOlder={onLoadOlder}
    >
      <ThreadTrace.List data-testid="thread-view-by-trace">
        {traces.map((trace, index) => (
          <ThreadTrace.Row key={trace.traceId} traceId={trace.traceId}>
            <ThreadTurn turn={index + 1} trace={trace} feedbackSlot={feedbackSlot} scoresSlot={scoresSlot} />
          </ThreadTrace.Row>
        ))}
      </ThreadTrace.List>
      <ThreadTrace.SpanPanel>
        <SelectedSpanDetail
          traces={traces}
          span={selectedSpanDetail}
          isLoading={isLoadingSelectedSpanDetail}
          registeredTools={registeredTools}
        />
      </ThreadTrace.SpanPanel>
    </ThreadTrace>
  );
}

interface ThreadTurnProps {
  /** 1-based position among the loaded turns. */
  turn: number;
  trace: ThreadViewTrace;
  feedbackSlot?: ThreadViewByTraceViewProps['feedbackSlot'];
  scoresSlot?: ThreadViewByTraceViewProps['scoresSlot'];
}

function ThreadTurn({ turn, trace, feedbackSlot, scoresSlot }: ThreadTurnProps) {
  const { highlightSpans } = useThreadTraceRow();
  const { Link, paths } = useLinkComponent();
  const { traceId, spans, isLoading, error } = trace;
  const traceHref = paths.traceLink(traceId);
  const rootSpanId = spans?.find(span => span.parentSpanId == null)?.spanId;

  return (
    <>
      <ThreadTrace.Divider label={`Turn ${turn}`}>
        {traceHref && (
          <>
            <Button render={<Link href={traceHref} />} variant="ghost" size="sm" icon={<IconSquareArrowTopRight />}>
              Go to trace
            </Button>
            <span aria-hidden className="h-4 w-px bg-border" />
          </>
        )}
        <ThreadTrace.TabList>
          <ThreadTrace.Tab value="messages">
            <Icon size="xs">
              <IconChatBubble7 />
            </Icon>
            Messages
          </ThreadTrace.Tab>
          {feedbackSlot && (
            <ThreadTrace.Tab value="feedback">
              <Icon size="xs">
                <IconChatBubble7Plus />
              </Icon>
              Feedback
            </ThreadTrace.Tab>
          )}
          {scoresSlot && (
            <ThreadTrace.Tab value="scores">
              <Icon size="xs">
                <ScorersIcon />
              </Icon>
              Scores
            </ThreadTrace.Tab>
          )}
        </ThreadTrace.TabList>
      </ThreadTrace.Divider>
      <ThreadTrace.RowBody>
        <ThreadTrace.Messages>
          <ThreadTrace.TabContent value="messages" flush>
            <TraceThreadItemView spans={spans} isLoading={isLoading} error={error} onHighlightSpans={highlightSpans} />
          </ThreadTrace.TabContent>
          {feedbackSlot && (
            <ThreadTrace.TabContent value="feedback" className="min-h-0 py-3">
              {feedbackSlot({ traceId })}
            </ThreadTrace.TabContent>
          )}
          {scoresSlot && (
            <ThreadTrace.TabContent value="scores" className="min-h-0 py-3">
              {rootSpanId ? scoresSlot({ traceId, rootSpanId }) : null}
            </ThreadTrace.TabContent>
          )}
        </ThreadTrace.Messages>
        <ThreadTrace.Details>
          <ThreadTrace.Spans spans={spans} isLoading={isLoading} />
        </ThreadTrace.Details>
      </ThreadTrace.RowBody>
    </>
  );
}

interface SelectedSpanDetailProps {
  traces: ThreadViewTrace[];
  span?: SpanRecord;
  isLoading?: boolean;
  registeredTools?: RegisteredTools;
}

/** The selected span's detail, with its trace's spans so its tool calls show their results. */
function SelectedSpanDetail({ traces, span, isLoading, registeredTools }: SelectedSpanDetailProps) {
  const { selected } = useThreadTrace();
  const traceSpans = traces.find(trace => trace.traceId === selected?.traceId)?.spans;
  return (
    <ThreadTrace.SpanDetail
      span={span}
      isLoading={isLoading}
      traceSpans={traceSpans}
      registeredTools={registeredTools}
    />
  );
}
