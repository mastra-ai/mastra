import { Shimmer } from '@mastra/playground-ui/components/Shimmer';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

/** Shell of a clickable transcript row: hover surface, pointer, and the `group/row` hover scope. */
export const ROW_TRIGGER = 'group/row hover:bg-neutral6/5 w-full cursor-pointer rounded-md text-left transition-colors';

/** Body of an expanded row, hanging off a rail drawn from the centre of the leading slot. */
export const ROW_RAIL = 'border-border1 ml-[14px] max-w-full min-w-0 border-l py-1.5 pr-1 pl-4';

function Chevron({ expanded, className }: { expanded: boolean; className: string }) {
  // Nested, not a direct trigger child — the DS trigger rotates direct-child <svg> on open.
  return (
    <ChevronRight
      size={13}
      aria-hidden
      className={cn('shrink-0 transition-[transform,color] duration-150', expanded && 'rotate-90', className)}
    />
  );
}

interface TranscriptRowProps {
  /** Leading glyph; a group of calls leads with the disclosure chevron instead. */
  icon?: ReactNode;
  label: string;
  detail?: string;
  /** Sweeps the label to say the row is in flight. */
  running?: boolean;
  /** Undefined marks the row as not collapsible, so it grows no disclosure chevron. */
  expanded?: boolean;
  /** Trails the label with a hairline, marking the row as a group of calls. */
  rule?: boolean;
  trailing?: ReactNode;
}

/** The one row shape every transcript line uses, so tools, signals and notifications share a rhythm. */
export function TranscriptRow({ icon, label, detail, running, expanded, rule, trailing }: TranscriptRowProps) {
  return (
    <span className="flex w-full min-w-0 items-center gap-2 px-1.5 py-1">
      <span className="flex size-4 shrink-0 items-center justify-center">
        {icon ?? <Chevron expanded={Boolean(expanded)} className="text-icon3 group-hover/row:text-icon5" />}
      </span>
      <Txt as="span" variant="ui-sm" className="text-icon5 max-w-[55%] shrink-0 truncate">
        {running ? <Shimmer>{label}</Shimmer> : label}
      </Txt>
      {detail && (
        <Txt as="span" variant="ui-xs" font="mono" className="text-icon3 min-w-0 truncate">
          {detail}
        </Txt>
      )}
      {icon && expanded !== undefined && (
        <Chevron expanded={expanded} className="text-icon2 group-hover/row:text-icon4" />
      )}
      {rule ? <span aria-hidden className="bg-border1 h-px min-w-2 flex-1" /> : <span className="flex-1" />}
      {trailing}
    </span>
  );
}
