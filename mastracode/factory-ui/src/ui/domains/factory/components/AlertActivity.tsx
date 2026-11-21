import { Txt } from '@mastra/playground-ui/components/Txt';

import { relativeTime } from '../../../../lib/date/relativeTime';
import type { WorkItem } from '../services/workItems';

/** Written by the Mastra Alerts source (`alertTimeline`, newest last; capped server-side). */
interface AlertTimelineEntry {
  at: string;
  kind: string;
  text: string;
  count?: number;
}

interface AlertSummary {
  fireCount?: number;
  severity?: string;
  incidentCount: number;
}

const KIND_LABELS: Record<string, string> = {
  fired: 'Fired',
  fired_again: 'Fired again',
  flapping: 'Flapping',
  severity_raised: 'Severity raised',
  recovered: 'Recovered',
  reopened: 'Reopened',
  mention: 'Mentioned in Slack',
};

function alertTimeline(metadata: Record<string, unknown>): AlertTimelineEntry[] {
  const raw = metadata.alertTimeline;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (entry): entry is AlertTimelineEntry =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as AlertTimelineEntry).at === 'string' &&
      typeof (entry as AlertTimelineEntry).kind === 'string' &&
      typeof (entry as AlertTimelineEntry).text === 'string',
  );
}

function alertSummary(metadata: Record<string, unknown>): AlertSummary | null {
  const state = metadata.alert;
  if (typeof state !== 'object' || state === null) return null;
  const { fireCount, severity, incidents } = state as Record<string, unknown>;
  return {
    fireCount: typeof fireCount === 'number' ? fireCount : undefined,
    severity: typeof severity === 'string' ? severity : undefined,
    incidentCount: typeof incidents === 'object' && incidents !== null ? Object.keys(incidents).length : 0,
  };
}

function summaryParts({ fireCount, severity, incidentCount }: AlertSummary): string[] {
  return [
    fireCount === undefined ? undefined : `Fired ${fireCount} ${fireCount === 1 ? 'time' : 'times'}`,
    incidentCount ? `${incidentCount} ${incidentCount === 1 ? 'incident' : 'incidents'}` : undefined,
    severity ? `highest severity ${severity}` : undefined,
  ].filter((part): part is string => Boolean(part));
}

/** What an alert card has seen since it was filed: fires, flaps, recoveries, reopens and Slack mentions. */
export function AlertActivity({ item }: { item: Pick<WorkItem, 'metadata'> }) {
  const timeline = alertTimeline(item.metadata);
  const summary = alertSummary(item.metadata);
  if (!timeline.length && !summary) return null;
  const parts = summary ? summaryParts(summary) : [];

  return (
    <section aria-label="Alert activity" className="flex flex-col gap-1">
      <Txt as="h4" variant="eyebrow" tone="muted" className="m-0">
        Alert activity
      </Txt>
      {parts.length > 0 && (
        <div aria-label="Alert summary" className="flex flex-wrap gap-x-3">
          {parts.map(part => (
            <Txt key={part} as="span" variant="meta" tone="muted">
              {part}
            </Txt>
          ))}
        </div>
      )}
      <ol className="m-0 flex list-none flex-col gap-1 p-0">
        {timeline.map((entry, index) => (
          <li key={`${entry.at}-${index}`} className="flex items-baseline gap-2">
            <Txt as="span" variant="caption" tone="ink" className="shrink-0 font-medium">
              {KIND_LABELS[entry.kind] ?? entry.kind}
              {entry.kind === 'flapping' && entry.count ? ` ×${entry.count}` : ''}
            </Txt>
            <Txt as="span" variant="caption" className="min-w-0 flex-1 wrap-anywhere">
              {entry.text}
            </Txt>
            <Txt as="time" variant="meta" tone="muted" className="shrink-0" dateTime={entry.at} title={entry.at}>
              {relativeTime(entry.at)}
            </Txt>
          </li>
        ))}
      </ol>
    </section>
  );
}
