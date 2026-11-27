import { TriangleAlert, UserX } from 'lucide-react';
import type { ComponentType, ReactElement } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { IconArrowUpRight } from '@/ds/icons/central/IconArrowUpRight';
import type { LinkComponent } from '@/ds/types/link-component';
import { cn } from '@/utils/cn';

export const RULE_CHIP = 'bg-fill-subtle hover:bg-fill flex h-6.5 min-w-0 items-center gap-1.5 rounded-full px-2.5';
export const CANVAS_SELECTED_RING = 'ring-foreground ring-2';

/**
 * How a chip or phase reads beside the selection: the selected one rings, unrelated ones fade. `elsewhere` is a
 * tested item's rule that matched but lost it to another board.
 */
export type FlowEmphasis = 'selected' | 'dimmed' | 'elsewhere' | undefined;

/** A trigger's name and icon. */
export interface FlowTrigger {
  label: string;
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}

/** Something worth knowing about a rule on its trigger. Warnings mark the rule's chip; the rest only explain it. */
export interface FlowRuleNote {
  tone: 'warning' | 'muted';
  text: string;
}

/** One rule on one trigger, as its chip shows it: a rule listening on two triggers shows twice, with its place on each. */
export interface FlowRuleLine {
  ruleId: string;
  /** The rule's own name; `label` names what it takes when it has no conditions. */
  name: string;
  enabled: boolean;
  event: string;
  trigger: FlowTrigger;
  /** New issues and pull requests arrive on its trigger. */
  opened: boolean;
  /** Its place on the trigger, from 1: the first rule that matches wins. */
  rank: number;
  /** How many of this board's rules listen on the trigger. */
  of: number;
  label: string;
  /** What it takes, one line per condition, each after the first led by its group's "and" or "or". */
  conditions: readonly string[];
  /** Items it filed in the last 30 days; only rules that file new items count them. */
  filed: number | undefined;
  skipsOutsiders: boolean;
  /** It only moves cards on its trigger, filing no new item. */
  movesCardsOnly: boolean;
  /** What is worth knowing about it, worst first. */
  notes: readonly FlowRuleNote[];
  /** A note naming the rules around it on its trigger; unset for a rule alone on it. */
  place: string | undefined;
  /** Opens the rule. */
  href: string;
  emphasis: FlowEmphasis;
  /** Lights its trigger while the numbered chip is under the pointer or focus; `false` once it leaves. */
  onPeek: (peeking: boolean) => void;
}

/** The trigger a run of chips listens on: its icon and name, before the first chip of the run. */
export function TriggerLabel({ trigger, dimmed = false }: { trigger: FlowTrigger; dimmed?: boolean }) {
  const { label, icon: Icon } = trigger;
  return (
    <span
      className={cn(
        'flex shrink-0 items-center gap-1.5 text-caption text-muted-foreground transition-opacity',
        dimmed && 'opacity-35',
      )}
    >
      <Icon className="size-icon-xs" aria-hidden />
      {label}
    </span>
  );
}

/** One rule on one trigger: its place on the trigger, its name, what it filed in the last 30 days, and its warnings. */
export function RuleChip({ line, LinkComponent: Link }: { line: FlowRuleLine; LinkComponent: LinkComponent }) {
  const { emphasis, notes } = line;
  const warned = notes.some(note => note.tone === 'warning');
  const peek =
    line.of > 1
      ? {
          onPointerEnter: () => line.onPeek(true),
          onPointerLeave: () => line.onPeek(false),
          onFocus: () => line.onPeek(true),
          onBlur: () => line.onPeek(false),
        }
      : undefined;

  return (
    <ChipTooltip
      title={line.label === line.name ? undefined : line.name}
      lines={[...line.conditions, ...(line.place ? [line.place] : []), ...notes.map(note => note.text)]}
    >
      <Link
        data-join=""
        data-dimmed={emphasis === 'dimmed' || undefined}
        href={line.href}
        {...peek}
        aria-current={emphasis === 'selected' ? 'true' : undefined}
        aria-label={`${line.name}, rule ${line.rank} of ${line.of} on ${line.trigger.label}${emphasis === 'elsewhere' ? ', matched but another board took it' : ''}`}
        className={cn(
          RULE_CHIP,
          'max-w-full transition-opacity',
          !line.enabled && 'opacity-50',
          emphasis === 'dimmed' && 'opacity-35',
          emphasis === 'selected' && CANVAS_SELECTED_RING,
        )}
      >
        {line.of > 1 && <RuleRank line={line} />}
        <span className={cn('truncate text-body-sm', line.enabled ? 'text-foreground' : 'text-muted-foreground')}>
          {line.label}
        </span>
        {line.filed !== undefined && (
          <span className="shrink-0 text-caption text-muted-foreground tabular-nums">{line.filed}</span>
        )}
        {line.skipsOutsiders && <UserX className="size-icon-xs shrink-0 text-muted-foreground" aria-hidden />}
        {warned && <TriangleAlert className="size-icon-xs shrink-0 text-warning-indicator" aria-hidden />}
        {emphasis === 'elsewhere' && (
          <IconArrowUpRight className="size-icon-xs shrink-0 text-muted-foreground" aria-hidden />
        )}
      </Link>
    </ChipTooltip>
  );
}

/** A rule's place among the rules on its trigger, when it shares the trigger. */
export function RuleRank({ line }: { line: { rank: number; of: number } }) {
  return (
    <span className="flex h-4 shrink-0 items-center rounded-lg bg-background px-1.5 text-meta text-muted-foreground tabular-nums">
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
