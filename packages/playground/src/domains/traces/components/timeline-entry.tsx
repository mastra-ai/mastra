import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ExternalLinkIcon } from 'lucide-react';

import type { TimelineSpan } from '../lib/build-thread-timeline';
import { formatClock } from '../lib/format-clock';
import { humanizeSpanName } from '../lib/humanize-span-name';
import { spanEntityLink } from '../lib/span-entity-link';
import { spanIcon } from '../lib/span-icon';
import { EntryContent } from './entry-renderers';
import { ownsFailure, rendersOwnPayload } from './entry-renderers/renders-own-payload';
import { MessageRow } from './message-row';
import { SpanFeedbackBubble } from './span-feedback-bubble';
import { SpanPayloadDetails } from './span-payload-details';
import { useLinkComponent } from '@/lib/framework';

export type TimelineEntryProps = {
  span: TimelineSpan;
  /** Enables the span comment bubble. Omit it to render the row without any feedback affordance. */
  traceId?: string;
  /** Existing comments on this span, from the trace-wide feedback page. */
  feedbackCount?: number;
};

function toDate(value: TimelineSpan['startedAt']): Date | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatDuration(span: TimelineSpan): string | undefined {
  const start = toDate(span.startedAt);
  const end = toDate(span.endedAt);
  if (!start || !end) return undefined;
  const ms = end.getTime() - start.getTime();
  if (ms < 0) return undefined;
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;
}

function formatTokens(span: TimelineSpan): string | undefined {
  const usage = span.attributes?.usage as { inputTokens?: number; outputTokens?: number } | undefined;
  const input = usage?.inputTokens;
  const output = usage?.outputTokens;
  if (typeof input !== 'number' && typeof output !== 'number') return undefined;
  return `${input ?? 0} ↑ / ${output ?? 0} ↓ tokens`;
}

function formatCost(span: TimelineSpan): string | undefined {
  const cost = span.attributes?.costContext as { estimatedCost?: number; costUnit?: string } | undefined;
  if (typeof cost?.estimatedCost !== 'number') return undefined;
  return `${cost.estimatedCost} ${cost.costUnit ?? 'USD'}`;
}

function errorMessage(error: unknown): string | undefined {
  if (!error) return undefined;
  if (typeof error === 'string') return error;
  if (typeof error === 'object') {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'Something went wrong';
}

/** One step the agent took, on the assistant's side of the thread: what happened, then its cost. */
export function TimelineEntry({ span, traceId, feedbackCount }: TimelineEntryProps) {
  const { Link } = useLinkComponent();
  const failure = errorMessage(span.error);
  const entityLink = spanEntityLink(span);
  // Every measurement lives on its own dimmed line below the message: the first line stays a plain
  // statement of what happened. The humanized name would only restate the subject shown above, so
  // it hangs off the icon, which is the one mark on the row that does not name what it stands for.
  const icon = spanIcon(span);
  const described = humanizeSpanName(span) || undefined;
  // A row that owns its payload opens on a button, taller than a line of prose: the icon and the
  // link get that same line box so they sit on the header instead of floating in the payload.
  const ownsPayload = rendersOwnPayload(span);
  const lineBox = ownsPayload ? 'flex h-7 items-center self-start' : 'mt-0.5 self-start';
  const link = entityLink ? (
    <Link
      href={entityLink}
      aria-label={`Open ${span.entityId} in Studio`}
      className={cn('text-neutral3 hover:text-neutral6 duration-normal shrink-0 transition-colors', lineBox)}
      data-testid="timeline-entry-link"
    >
      <ExternalLinkIcon className="size-3" />
    </Link>
  ) : null;
  const meta = [formatDuration(span), formatTokens(span), formatCost(span)].filter(Boolean);

  return (
    <MessageRow
      as="li"
      meta={[formatClock(span.startedAt), ...meta]}
      testId="timeline-entry"
      dataError={failure ? 'true' : undefined}
      action={
        traceId && span.spanId ? (
          <SpanFeedbackBubble traceId={traceId} spanId={span.spanId} count={feedbackCount} />
        ) : null
      }
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {/* Without a rail, the icon travels with the message to keep the actor recognizable. */}
        {icon ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <span
                  className={cn('text-neutral3 shrink-0 [&_svg]:size-3.5', lineBox)}
                  aria-label={described}
                  data-testid="timeline-entry-icon"
                />
              }
            >
              {icon}
            </TooltipTrigger>
            <TooltipContent>{described}</TooltipContent>
          </Tooltip>
        ) : null}
        {/* A row that owns its payload stretches across the timeline, so the link is handed to its
            header instead: left where it is, it would drift to the far edge, away from the name. */}
        <EntryContent span={span} adornment={ownsPayload ? link : undefined} />
        {link && !ownsPayload ? link : null}
      </div>

      {failure && !ownsFailure(span) ? (
        <p className="text-accent2 text-ui-smd" data-testid="timeline-entry-error">
          {failure}
        </p>
      ) : null}

      {ownsPayload ? null : <SpanPayloadDetails span={span} />}
    </MessageRow>
  );
}
