import { Badge } from '@mastra/playground-ui/components/Badge';
import { InlineCode } from '@mastra/playground-ui/components/InlineCode';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowRight, Lock, Play, Sparkles, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { useScrollToHash } from './StoryExplain';
import { ruleAnchorId } from './storyLinks';
import type { StoryRule } from './storyRules';
import { ruleById, STORY_RULES } from './storyRules';
import { useStoryboard } from './StoryboardProvider';
import { StorySectionHeader } from './StorySectionHeader';

const LANE_LABELS: Record<string, string> = {
  intake: 'Intake',
  triage: 'Triage',
  planning: 'Planning',
  review: 'Review',
};

function rulesWith(suggestingRuleId: string | undefined): StoryRule[] {
  if (!suggestingRuleId || STORY_RULES.some(rule => rule.id === suggestingRuleId)) return STORY_RULES;
  return [...STORY_RULES, ruleById(suggestingRuleId)];
}

function RuleChip({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="bg-fill text-foreground inline-flex h-6 max-w-full min-w-0 items-center gap-1.5 rounded-full px-2.5 text-xs">
      <Icon size={12} className="text-muted-foreground shrink-0" aria-hidden />
      <span className="truncate">{children}</span>
    </span>
  );
}

function RuleRow({ rule, suggested, linked }: { rule: StoryRule; suggested: boolean; linked: boolean }) {
  return (
    <li
      id={ruleAnchorId(rule.id)}
      className={cn(
        'grid scroll-mt-4 gap-x-6 gap-y-2 px-4 py-3 md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_minmax(0,14rem)] md:items-center',
        linked && 'bg-info-subtle',
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <Txt as="span" variant="label" tone="ink">
          {rule.title}
        </Txt>
        <Txt as="span" variant="meta" tone="faint" font="mono" className="truncate">
          {rule.id}
        </Txt>
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <RuleChip icon={Zap}>{rule.when}</RuleChip>
          <ArrowRight size={12} className="text-muted-foreground shrink-0" aria-label="then" />
          <RuleChip icon={Play}>{rule.then}</RuleChip>
        </div>
        <Txt as="span" variant="meta" tone="muted">
          {rule.conditions.join(' · ')}
        </Txt>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
        {suggested && (
          <Badge size="xs" variant="info" emphasis="subtle" icon={<Sparkles aria-hidden />}>
            Suggested the card
          </Badge>
        )}
        {rule.lanes.map(lane => (
          <Badge key={lane} size="xs" variant="neutral" emphasis="subtle">
            {LANE_LABELS[lane] ?? lane}
          </Badge>
        ))}
        {rule.source === 'built-in' && (
          <Badge size="xs" variant="warning" emphasis="subtle" icon={<Lock aria-hidden />}>
            Built-in
          </Badge>
        )}
      </div>
    </li>
  );
}

export function StoryRulesNotice() {
  const storyboard = useStoryboard();
  const linkedAnchor = useScrollToHash(storyboard !== null);
  if (storyboard === null) return null;
  const suggestingRuleId = storyboard.state.cards.find(card => card.suggestedBy)?.suggestedBy;

  return (
    <section aria-labelledby="story-rules-heading" className="mb-8 flex shrink-0 flex-col gap-4">
      <StorySectionHeader
        id="story-rules-heading"
        title="Rules"
        description={
          <>
            One trigger, one action. Every suggestion and every card waiting for you comes from one of these. Read-only
            here: edit them in <InlineCode>factory.config.ts</InlineCode>. Built-in rules cannot be changed yet.
          </>
        }
      />
      <ul className="border-border divide-border divide-y rounded-xl border">
        {rulesWith(suggestingRuleId).map(rule => (
          <RuleRow
            key={rule.id}
            rule={rule}
            suggested={rule.id === suggestingRuleId}
            linked={linkedAnchor === ruleAnchorId(rule.id)}
          />
        ))}
      </ul>
    </section>
  );
}
