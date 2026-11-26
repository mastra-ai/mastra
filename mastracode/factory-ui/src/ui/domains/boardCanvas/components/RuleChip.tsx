import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { IconArrowUpRight } from '@mastra/playground-ui/icons/central/IconArrowUpRight';
import { cn } from '@mastra/playground-ui/utils/cn';
import { TriangleAlert, UserX } from 'lucide-react';
import type { ReactElement } from 'react';
import { Link } from 'react-router';

import { laneText } from '../../boardRules/ruleLanes';
import type { RuleEvent } from '../../boardRules/ruleLanes';
import { ruleNotes } from '../canvasModel';
import type { Emphasis, RuleLine } from '../canvasModel';

export const CHIP = 'bg-fill-subtle hover:bg-fill flex h-6.5 min-w-0 items-center gap-1.5 rounded-full px-2.5';
export const SELECTED_RING = 'ring-foreground ring-2';

/** How a numbered chip shows its order: a note naming the rules around it, and its trigger lit while it's pointed at. */
export interface LaneOrder {
  note: (line: RuleLine) => string | undefined;
  /** The trigger of the numbered chip under the pointer or focus; undefined once it leaves. */
  onPeek: (event: RuleEvent | undefined) => void;
}

/** The trigger a run of chips listens on: its icon and name, before the first chip of the run. */
export function TriggerLabel({ event, dimmed = false }: { event: string; dimmed?: boolean }) {
  const { label, icon: Icon } = laneText(event);
  return (
    <span
      className={cn(
        'text-caption text-muted-foreground flex shrink-0 items-center gap-1.5 transition-opacity',
        dimmed && 'opacity-35',
      )}
    >
      <Icon className="size-icon-xs" aria-hidden />
      {label}
    </span>
  );
}

/** One rule on one trigger: its place on the trigger, its name, what it filed in the last 30 days, and its warnings. */
export function RuleChip({
  line,
  to,
  emphasis,
  lanes,
}: {
  line: RuleLine;
  to: string;
  emphasis: Emphasis;
  lanes: LaneOrder;
}) {
  const notes = ruleNotes(line);
  const warned = notes.some(note => note.tone === 'warning');
  const place = lanes.note(line);
  const peek =
    line.of > 1
      ? {
          onPointerEnter: () => lanes.onPeek(line.event),
          onPointerLeave: () => lanes.onPeek(undefined),
          onFocus: () => lanes.onPeek(line.event),
          onBlur: () => lanes.onPeek(undefined),
        }
      : undefined;

  return (
    <ChipTooltip
      title={line.label === line.rule.name ? undefined : line.rule.name}
      lines={[...(place ? [place] : []), ...notes.map(note => note.text)]}
    >
      <Link
        data-join=""
        data-dimmed={emphasis === 'dimmed' || undefined}
        to={to}
        {...peek}
        aria-current={emphasis === 'selected' ? 'true' : undefined}
        aria-label={`${line.rule.name}, rule ${line.rank} of ${line.of} on ${laneText(line.event).label}${emphasis === 'elsewhere' ? ', matched but another board took it' : ''}`}
        className={cn(
          CHIP,
          'max-w-full transition-opacity',
          !line.rule.enabled && 'opacity-50',
          emphasis === 'dimmed' && 'opacity-35',
          emphasis === 'selected' && SELECTED_RING,
        )}
      >
        {line.of > 1 && <RuleRank line={line} />}
        <span className={cn('text-body-sm truncate', line.rule.enabled ? 'text-foreground' : 'text-muted-foreground')}>
          {line.label}
        </span>
        {line.filed !== undefined && (
          <span className="text-caption text-muted-foreground shrink-0 tabular-nums">{line.filed}</span>
        )}
        {line.skipsOutsiders && <UserX className="text-muted-foreground size-icon-xs shrink-0" aria-hidden />}
        {warned && <TriangleAlert className="text-warning-indicator size-icon-xs shrink-0" aria-hidden />}
        {emphasis === 'elsewhere' && (
          <IconArrowUpRight className="text-muted-foreground size-icon-xs shrink-0" aria-hidden />
        )}
      </Link>
    </ChipTooltip>
  );
}

/** A rule's place among the rules on its trigger, when it shares the trigger. */
export function RuleRank({ line }: { line: Pick<RuleLine, 'rank' | 'of'> }) {
  return (
    <span className="bg-background text-meta text-muted-foreground flex h-4 shrink-0 items-center rounded-lg px-1.5 tabular-nums">
      {line.rank}/{line.of}
    </span>
  );
}

/** A chip's full name and what is worth knowing about it, on hover. Nothing to add, no tooltip. */
export function ChipTooltip({
  title,
  lines,
  children,
}: {
  title: string | undefined;
  lines: readonly string[];
  children: ReactElement;
}) {
  if (!title && lines.length === 0) return children;
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent className="flex max-w-72 flex-col gap-1">
        {title && <span className="text-foreground">{title}</span>}
        {lines.map(line => (
          <span key={line}>{line}</span>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}
