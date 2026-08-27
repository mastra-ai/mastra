import { ExternalLinkIcon } from 'lucide-react';

import type { TimelineSpan } from '../lib/build-thread-timeline';
import { humanizeSpanName } from '../lib/humanize-span-name';
import { spanEntityLink } from '../lib/span-entity-link';
import { spanIcon } from '../lib/span-icon';
import { formatClock, spanKind } from '../lib/span-kind';
import { EntryContent } from './entry-renderers';
import { ownsFailure, rendersOwnPayload } from './entry-renderers/renders-own-payload';
import { SpanFeedbackBubble } from './span-feedback-bubble';
import { SpanPayloadDetails } from './span-payload-details';
import { TimelineRow } from './timeline-row';
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

/** One step on the timeline: offset gutter, kind, prose, then error state and meta (decision 6). */
export function TimelineEntry({ span, traceId, feedbackCount }: TimelineEntryProps) {
  const { Link } = useLinkComponent();
  const failure = errorMessage(span.error);
  const entityLink = spanEntityLink(span);
  // Every measurement lives on its own dimmed line below the prose: the first line stays a plain
  // statement of what happened. The wall clock is not repeated here — the gutter carries it — and
  // the humanized name would only restate the kind and subject shown above, so it stays hover text.
  const link = entityLink ? (
    <Link
      href={entityLink}
      aria-label={`Open ${span.entityId} in Studio`}
      className="text-neutral3 hover:text-neutral6 duration-normal shrink-0 self-center transition-colors"
      data-testid="timeline-entry-link"
    >
      <ExternalLinkIcon className="size-3" />
    </Link>
  ) : null;
  const meta = [formatDuration(span), formatTokens(span), formatCost(span)].filter(Boolean);

  return (
    <TimelineRow
      as="li"
      title={humanizeSpanName(span) || undefined}
      offset={formatClock(span.startedAt)}
      kind={spanKind(span)}
      icon={spanIcon(span)}
      tone={failure ? 'error' : span.spanType === 'model_generation' ? 'accent' : 'default'}
      testId="timeline-entry"
      dataError={failure ? 'true' : undefined}
      action={
        traceId && span.spanId ? (
          <SpanFeedbackBubble traceId={traceId} spanId={span.spanId} count={feedbackCount} />
        ) : null
      }
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        {/* A row that owns its payload stretches across the timeline, so the link is handed to its
            header instead: left where it is, it would drift to the far edge, away from the name. */}
        <EntryContent span={span} adornment={rendersOwnPayload(span) ? link : undefined} />
        {link && !rendersOwnPayload(span) ? link : null}
      </div>

      {meta.length > 0 ? (
        <p className="text-neutral3 text-ui-xs font-mono tabular-nums" data-testid="timeline-entry-details">
          {meta.join(' · ')}
        </p>
      ) : null}

      {failure && !ownsFailure(span) ? (
        <p className="text-accent2 text-ui-smd" data-testid="timeline-entry-error">
          {failure}
        </p>
      ) : null}

      {rendersOwnPayload(span) ? null : <SpanPayloadDetails span={span} />}
    </TimelineRow>
  );
}
