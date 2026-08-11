import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ChevronRight, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import type { ToolCall } from '../../services/transcript';

/** Shell of a clickable tool row: hover surface, pointer, and the `group/tool` hover scope. */
export const TOOL_ROW_TRIGGER =
  'group/tool hover:bg-neutral6/5 w-full cursor-pointer rounded-md text-left transition-colors';

/** Left offset of the rail under an expanded row: the centre of the leading slot. */
export const TOOL_RAIL_OFFSET = 'ml-[14px]';

export function ToolStatusIcon({ status }: { status: ToolCall['status'] }) {
  if (status === 'running') return <Spinner size="sm" aria-label="Running" className="text-icon3 size-3" />;
  if (status === 'error') return <X size={13} role="img" aria-label="Failed" className="text-error" />;
  return null;
}

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

interface ToolRowProps {
  /** A single call leads with its tool icon; a group leads with the disclosure chevron instead. */
  icon?: LucideIcon;
  label: string;
  detail?: string;
  status: ToolCall['status'];
  expanded: boolean;
  /** Trails the label with a hairline, marking the row as a group of calls. */
  rule?: boolean;
  trailing?: ReactNode;
}

/** The one row shape every tool line uses, so single calls and groups share a rhythm. */
export function ToolRow({ icon: Icon, label, detail, status, expanded, rule, trailing }: ToolRowProps) {
  return (
    <span className="flex w-full min-w-0 items-center gap-2 px-1.5 py-1">
      <span className="flex size-4 shrink-0 items-center justify-center">
        {Icon ? (
          <Icon
            size={14}
            strokeWidth={1.75}
            aria-hidden
            className={status === 'error' ? 'text-error/80' : 'text-icon3'}
          />
        ) : (
          <Chevron expanded={expanded} className="text-icon3 group-hover/tool:text-icon5" />
        )}
      </span>
      <Txt
        as="span"
        variant="ui-sm"
        className={cn('shrink-0', status === 'running' ? 'text-shimmer text-icon4' : 'text-icon5')}
      >
        {label}
      </Txt>
      {detail && (
        <Txt as="span" variant="ui-xs" font="mono" className="text-icon3 min-w-0 truncate">
          {detail}
        </Txt>
      )}
      {Icon && <Chevron expanded={expanded} className="text-icon2 group-hover/tool:text-icon4" />}
      {rule ? <span aria-hidden className="bg-border1 h-px min-w-2 flex-1" /> : <span className="flex-1" />}
      {trailing}
      <ToolStatusIcon status={status} />
    </span>
  );
}
