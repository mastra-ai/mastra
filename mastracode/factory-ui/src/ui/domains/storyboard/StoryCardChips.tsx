import { Badge } from '@mastra/playground-ui/components/Badge';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SlackIcon } from '@mastra/playground-ui/icons/SlackIcon';
import { Hand, Zap } from 'lucide-react';

import { actorName } from './cast';
import { RuleBadge } from './StoryLaneRules';
import { APPROVAL_RULE, AUTO_START_RULE, SLACK_RULE } from './storyRules';
import type { CardFacts } from './storyState';

function authorLabel(facts: CardFacts): string {
  return facts.author === 'external' ? 'someone outside the team' : actorName(facts.author);
}

function approvalReason(facts: CardFacts): string {
  if (facts.owner === 'factory') return 'The run paused for a person. Your reply unblocks it and makes you the owner.';
  return `${actorName(facts.owner)}'s run paused for a person before its next step.`;
}

export function StoryCardChips({ facts }: { facts: CardFacts }) {
  const fromSlack = facts.origin === 'slack-channel' || facts.origin === 'slack-dm';
  if (!fromSlack && facts.origin !== 'auto' && !facts.needsHuman && !facts.suggestedBy) return null;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {fromSlack && (
        <RuleBadge
          ruleId={SLACK_RULE}
          reason={`${authorLabel(facts)} mentioned Factory in ${facts.origin === 'slack-dm' ? 'a Slack DM' : 'a Slack channel'}.`}
        >
          <Badge size="xs" icon={<SlackIcon aria-hidden />}>
            {facts.origin === 'slack-dm' ? 'From a Slack DM' : 'From Slack'}
          </Badge>
        </RuleBadge>
      )}
      {facts.origin === 'auto' && (
        <RuleBadge
          ruleId={AUTO_START_RULE}
          reason={`Opened by ${authorLabel(facts)}; the Factory started the run on its own.`}
        >
          <Badge size="xs" icon={<Zap aria-hidden />}>
            Auto-started
          </Badge>
        </RuleBadge>
      )}
      {facts.needsHuman && (
        <RuleBadge ruleId={APPROVAL_RULE} reason={approvalReason(facts)}>
          <Badge size="xs" variant="orange" icon={<Hand aria-hidden />}>
            Needs you
          </Badge>
        </RuleBadge>
      )}
      {facts.suggestedBy && (
        <RuleBadge ruleId={facts.suggestedBy}>
          <Badge size="xs" variant="orange" emphasis="subtle" icon={<Zap aria-hidden />} className="min-w-0">
            <span className="truncate">
              Suggested by rule{' '}
              <Txt as="span" variant="meta" font="mono">
                {facts.suggestedBy}
              </Txt>
            </span>
          </Badge>
        </RuleBadge>
      )}
    </div>
  );
}
