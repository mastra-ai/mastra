import type { KnowledgeImporterRunEvent } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ArrowDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { describeElapsed } from '../run-log';
import type { RunLogRow } from '../run-log';

/** How close to the bottom still counts as following the tail. */
const FOLLOW_SLACK_PX = 24;

export interface RunLogLinesProps {
  rows: RunLogRow[];
  /** When the run started; timestamps are relative to it. */
  origin: string | undefined;
  emptyCopy: string;
}

/** The scrolling log. Follows new lines until the reader scrolls up, then offers a way back. */
export function RunLogLines({ rows, origin, emptyCopy }: RunLogLinesProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [following, setFollowing] = useState(true);
  // The requests line grows in place, so its text counts as new content too.
  const tail = rows.map(row => (row.kind === 'requests' ? row.message : row.key)).join('|').length;

  useEffect(() => {
    const element = scroller.current;
    if (following && element) element.scrollTop = element.scrollHeight;
  }, [tail, following]);

  const onScroll = () => {
    const element = scroller.current;
    if (!element) return;
    setFollowing(element.scrollHeight - element.scrollTop - element.clientHeight <= FOLLOW_SLACK_PX);
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scroller}
        onScroll={onScroll}
        data-testid="run-log-scroller"
        className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-fill-subtle px-3 py-2"
      >
        {rows.length === 0 ? (
          <Txt variant="body-sm" tone="muted">
            {emptyCopy}
          </Txt>
        ) : (
          <ol aria-label="Run log" className="flex flex-col gap-1">
            {rows.map(row =>
              row.kind === 'event' ? (
                <RunLogLine key={row.key} event={row.event} origin={origin} />
              ) : (
                <RunLogRequestsLine key={row.key} at={row.at} message={row.message} origin={origin} />
              ),
            )}
          </ol>
        )}
      </div>
      {following ? null : (
        <div className="absolute inset-x-0 bottom-3 flex justify-center">
          <Button size="sm" icon={<ArrowDown />} onClick={() => setFollowing(true)}>
            Jump to latest
          </Button>
        </div>
      )}
    </div>
  );
}

const LEVEL_BADGE = {
  warn: { label: 'Warning', variant: 'warning' },
  error: { label: 'Error', variant: 'destructive' },
} as const;

function RunLogLine({ event, origin }: { event: KnowledgeImporterRunEvent; origin: string | undefined }) {
  return (
    <li className="grid grid-cols-[4.5rem_1fr] items-baseline gap-3" data-level={event.level}>
      <Txt as="span" variant="caption" font="mono" tone="muted" className="tabular-nums" title={event.at}>
        {describeElapsed(origin, event.at)}
      </Txt>
      <span className="flex min-w-0 items-baseline gap-2">
        {event.level === 'warn' || event.level === 'error' ? (
          <Badge variant={LEVEL_BADGE[event.level].variant} emphasis="subtle" size="sm">
            {LEVEL_BADGE[event.level].label}
          </Badge>
        ) : null}
        <Txt
          as="span"
          variant="body-sm"
          font="mono"
          tone={event.level === 'debug' ? 'muted' : undefined}
          className="min-w-0 break-words"
        >
          {event.message}
        </Txt>
      </span>
    </li>
  );
}

function RunLogRequestsLine({ at, message, origin }: { at: string; message: string; origin: string | undefined }) {
  return (
    <li className="grid grid-cols-[4.5rem_1fr] items-baseline gap-3" data-level="debug" data-testid="run-log-requests">
      <Txt as="span" variant="caption" font="mono" tone="muted" className="tabular-nums" title={at}>
        {describeElapsed(origin, at)}
      </Txt>
      <Txt as="span" variant="body-sm" font="mono" tone="muted" className="min-w-0 break-words">
        {message}
      </Txt>
    </li>
  );
}
