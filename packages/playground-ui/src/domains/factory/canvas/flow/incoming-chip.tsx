import { CANVAS_SELECTED_RING, ChipTooltip, RULE_CHIP } from './rule-chip';
import type { FlowEmphasis } from './rule-chip';
import { IconArrowDownRight } from '@/ds/icons/central/IconArrowDownRight';
import type { LinkComponent } from '@/ds/types/link-component';
import { cn } from '@/utils/cn';

/** Another board's rule that moves its cards onto this board. */
export interface FlowIncomingRule {
  ruleId: string;
  name: string;
  enabled: boolean;
  /** What it takes, one line per condition, each after the first led by its group's "and" or "or". */
  conditions: readonly string[];
  /** The board the rule is on, by name. */
  boardName: string;
  /** Opens the rule on its board. */
  href: string;
  emphasis: FlowEmphasis;
}

/**
 * Another board's rule as a chip named after its board, opening the rule there. `stray` when the phase it moves cards
 * into is one this board no longer has.
 */
export function IncomingChip({
  rule,
  stray = false,
  LinkComponent: Link,
}: {
  rule: FlowIncomingRule;
  stray?: boolean;
  LinkComponent: LinkComponent;
}) {
  const { emphasis } = rule;
  const into = stray ? 'into a phase this board doesn’t have' : 'here';
  return (
    <ChipTooltip
      title={undefined}
      lines={[
        `“${rule.name}” on ${rule.boardName} moves cards ${into}.`,
        ...rule.conditions,
        ...(rule.enabled ? [] : ['Off, skipped']),
      ]}
    >
      <Link
        data-join=""
        data-dimmed={emphasis === 'dimmed' || undefined}
        href={rule.href}
        aria-label={rule.enabled ? rule.boardName : `${rule.boardName}, off`}
        className={cn(
          RULE_CHIP,
          'border border-border bg-transparent text-body-sm transition-opacity',
          rule.enabled ? 'text-foreground' : 'text-muted-foreground opacity-50',
          emphasis === 'dimmed' && 'opacity-35',
          emphasis === 'selected' && CANVAS_SELECTED_RING,
        )}
      >
        <IconArrowDownRight className="size-icon-xs shrink-0" aria-hidden />
        <span className="truncate">{rule.boardName}</span>
        {!rule.enabled && <span className="shrink-0 text-caption">Off</span>}
      </Link>
    </ChipTooltip>
  );
}
