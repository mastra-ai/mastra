import type { TimelineSpan } from '../lib/build-thread-timeline';
import { humanizeSpanName } from '../lib/humanize-span-name';
import { formatOffset, spanKind } from '../lib/span-kind';
import { EntryContent } from './entry-renderers';
import { TimelineRow } from './timeline-row';

export type TimelineEntryProps = {
  span: TimelineSpan;
  /** Epoch ms the turn started, so the gutter can show an offset instead of a wall clock. */
  turnStart?: number;
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
export function TimelineEntry({ span, turnStart }: TimelineEntryProps) {
  const failure = errorMessage(span.error);
  const meta = [formatDuration(span), formatTokens(span), formatCost(span)].filter(Boolean);
  const startedAt = toDate(span.startedAt);
  // Decision 6: the humanized name and the wall clock are displayed, but on their own dimmed
  // line so they never compete with the prose. The same string doubles as hover text.
  const details = [humanizeSpanName(span), startedAt?.toLocaleTimeString()].filter(Boolean).join(' · ');

  return (
    <TimelineRow
      as="li"
      title={details || undefined}
      offset={formatOffset(span.startedAt, turnStart)}
      kind={spanKind(span)}
      tone={failure ? 'error' : span.spanType === 'model_generation' ? 'accent' : 'default'}
      testId="timeline-entry"
      dataError={failure ? 'true' : undefined}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <EntryContent span={span} />
        {meta.length > 0 ? (
          <span className="text-neutral2/70 text-ui-xs font-mono tabular-nums">{meta.join(' · ')}</span>
        ) : null}
      </div>

      {details ? (
        <p className="text-neutral2/50 text-ui-xs" data-testid="timeline-entry-details">
          {details}
        </p>
      ) : null}

      {failure ? (
        <p className="text-accent2 text-ui-sm" data-testid="timeline-entry-error">
          {failure}
        </p>
      ) : null}
    </TimelineRow>
  );
}
