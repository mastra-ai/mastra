import { Shimmer } from '@mastra/playground-ui/components/Shimmer';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

import { useArriving } from '@mastra/playground-ui/components/Arrival';

/** Shell of a clickable transcript row: hover surface, pointer, and the `group/row` hover scope. */
export const ROW_TRIGGER = 'group/row hover:bg-neutral6/5 w-full cursor-pointer rounded-md text-left transition-colors';

/** Body of an expanded row, hanging off a rail drawn from the centre of the leading slot and faded out at its foot. */
export const ROW_RAIL =
  "relative ml-[14px] max-w-full min-w-0 py-1.5 pr-1 pl-4 before:bg-border1 before:absolute before:inset-y-0 before:left-0 before:w-px before:content-[''] before:mask-b-from-[calc(100%-min(40%,80px))]";

function Chevron({ expanded, className }: { expanded: boolean; className: string }) {
  // Nested, not a direct trigger child — the DS trigger rotates direct-child <svg> on open.
  return (
    <span
      aria-hidden
      className={cn('flex shrink-0 items-center transition duration-150', expanded && 'rotate-90', className)}
    >
      <ChevronRight size={13} />
    </span>
  );
}

interface TranscriptRowProps {
  /** Glyph naming the kind of row, held in the leading column every row shares. */
  icon?: ReactNode;
  label: string;
  detail?: string;
  /** Glyphs standing in for what a collapsed row holds, sat next to the label. */
  summary?: ReactNode;
  /** Sweeps the label to say the row is in flight. */
  running?: boolean;
  /** Undefined marks the row as not collapsible, so its trailing disclosure column stays empty. */
  expanded?: boolean;
  /** Trails the label with a hairline, marking the row as a group of calls. */
  rule?: boolean;
  trailing?: ReactNode;
}

const ROW_LINE = 'flex w-full min-w-0 items-center gap-2 px-1.5 py-1';

/** Its own element, so a detail that fills in under a standing row fades in on its own. */
function RowDetail({ detail }: { detail: string }) {
  const arriving = useArriving();

  return (
    <Txt as="span" variant="ui-xs" font="mono" className={cn('text-icon3 min-w-0 truncate', arriving)}>
      {detail}
    </Txt>
  );
}

/** The one row shape every transcript line uses, so tools, signals and notifications share a rhythm. */
export function TranscriptRow({ icon, label, detail, summary, running, expanded, rule, trailing }: TranscriptRowProps) {
  return (
    <Shimmer active={Boolean(running)} className={ROW_LINE}>
      <span className="flex size-4 shrink-0 items-center justify-center">{icon}</span>
      <Txt as="span" variant="ui-sm" className="text-icon3 max-w-[55%] shrink-0 truncate">
        {label}
      </Txt>
      {detail && <RowDetail detail={detail} />}
      {summary}
      <span
        aria-hidden
        className={cn('min-w-2 flex-1', rule && 'bg-border1 mask-r-from-[calc(100%-min(100%,160px))] h-px')}
      />
      {trailing}
      <span className="flex size-4 shrink-0 items-center justify-center">
        {expanded !== undefined && (
          <Chevron
            expanded={expanded}
            className={cn(
              'text-icon3 group-hover/row:opacity-100 group-focus-visible/row:opacity-100',
              !expanded && 'opacity-0',
            )}
          />
        )}
      </span>
    </Shimmer>
  );
}
