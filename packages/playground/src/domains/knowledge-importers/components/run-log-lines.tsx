import type { KnowledgeImporterRunEvent } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ArrowDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { describeElapsed } from '../run-log';

/** How close to the bottom still counts as following the tail. */
const FOLLOW_SLACK_PX = 24;

export interface RunLogLinesProps {
  events: KnowledgeImporterRunEvent[];
  /** When the run started; timestamps are relative to it. */
  origin: string | undefined;
  emptyCopy: string;
}

/** The scrolling log. Follows new lines until the reader scrolls up, then offers a way back. */
export function RunLogLines({ events, origin, emptyCopy }: RunLogLinesProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const [following, setFollowing] = useState(true);
  const lastSeq = events.at(-1)?.seq;

  useEffect(() => {
    const element = scroller.current;
    if (following && element) element.scrollTop = element.scrollHeight;
  }, [lastSeq, following]);

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
        {events.length === 0 ? (
          <Txt variant="body-sm" tone="muted">
            {emptyCopy}
          </Txt>
        ) : (
          <ol aria-label="Run log" className="flex flex-col gap-1">
            {events.map(event => (
              <RunLogLine key={event.seq} event={event} origin={origin} />
            ))}
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
        {event.level === 'info' ? null : (
          <Badge variant={LEVEL_BADGE[event.level].variant} emphasis="subtle" size="sm">
            {LEVEL_BADGE[event.level].label}
          </Badge>
        )}
        <Txt as="span" variant="body-sm" font="mono" className="min-w-0 break-words">
          {event.message}
        </Txt>
      </span>
    </li>
  );
}
