import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Play } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';

import { RAIL_LIST, RailRow } from '../factory/components/Timeline';
import { useStoryCard } from './StoryboardProvider';
import { StoryRuleLink } from './StoryExplain';
import type { StoryRule } from './storyRules';
import { RULE_SOURCE_LABELS, ruleById } from './storyRules';
import { RailText, StepMark, TriggerRow } from './workflows/WorkflowFlow';

export function RuleFlow({ rule, reason }: { rule: StoryRule; reason?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Txt as="p" variant="label" tone="ink">
          {rule.title}
        </Txt>
        {reason && (
          <Txt as="p" variant="meta" tone="muted">
            {reason}
          </Txt>
        )}
      </div>
      <ol className={RAIL_LIST}>
        <TriggerRow trigger={rule.when} connected />
        <RailRow connected={false} mark={<StepMark icon={Play} />}>
          <RailText title={rule.then}>
            <Txt as="span" variant="meta" tone="faint">
              Action
            </Txt>
          </RailText>
        </RailRow>
      </ol>
      <div className="flex flex-col gap-0.5">
        <Txt as="span" variant="meta" tone="muted">
          {rule.conditions.join(' · ')}
        </Txt>
        <Txt as="span" variant="meta" tone="faint">
          {RULE_SOURCE_LABELS[rule.source]}
        </Txt>
      </div>
      <StoryRuleLink ruleId={rule.id} />
    </div>
  );
}

export function RulePopover({ trigger, rule, reason }: { trigger: ReactElement; rule: StoryRule; reason?: ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger openOnHover delay={150} closeDelay={100} render={trigger} />
      <PopoverContent align="start" className="w-80 p-3">
        <RuleFlow rule={rule} reason={reason} />
      </PopoverContent>
    </Popover>
  );
}

export function RuleBadge({ ruleId, reason, children }: { ruleId: string; reason?: ReactNode; children: ReactNode }) {
  return (
    <RulePopover
      rule={ruleById(ruleId)}
      reason={reason}
      trigger={
        <button type="button" className="relative z-10 flex min-w-0 rounded-full">
          {children}
        </button>
      }
    />
  );
}

export function StoryRuleBadge({
  itemId,
  ruleId,
  reason,
  children,
}: {
  itemId: string;
  ruleId: string;
  reason?: ReactNode;
  children: ReactNode;
}) {
  if (useStoryCard(itemId) === null) return children;
  return (
    <RuleBadge ruleId={ruleId} reason={reason}>
      {children}
    </RuleBadge>
  );
}
