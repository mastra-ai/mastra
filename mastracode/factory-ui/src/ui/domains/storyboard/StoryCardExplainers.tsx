import { Badge } from '@mastra/playground-ui/components/Badge';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Hand, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import { possessive } from './cast';
import { blockedShort, capitalize } from './storyBillingCopy';
import { StoryExplain, StorySettingsLink } from './StoryExplain';
import { RulePopover } from './StoryLaneRules';
import { payerRuleAnchor } from './storyComposer';
import { blockedFix } from './storyLinks';
import { HOLD_NON_BUGS_RULE, ruleById } from './storyRules';
import type { Billing, CardFacts, StoryState } from './storyState';
import { laneRunsOn } from './storyState';

export function payerReason(state: StoryState, facts: CardFacts, stage?: string): string {
  if (facts.pinned) return `The ${facts.pinned.step} is pinned: it always bills the Factory account.`;
  if (facts.movedFrom)
    return `Moved off ${possessive(facts.movedFrom)} plan on purpose: a message alone never moves the bill.`;
  switch (facts.origin) {
    case 'auto':
      return 'Auto-started: with nobody around, only the Factory account can pay.';
    case 'slack-channel':
      return 'Started from a Slack channel: Slack settings decide where it runs.';
    case 'slack-dm':
      return 'Started from a Slack DM: Slack settings decide where it runs.';
    case 'board':
      if (facts.surface === 'chat') return "A personal session: it runs on its owner's plan.";
      return boardPayerReason(state, stage);
  }
}

function boardPayerReason(state: StoryState, stage?: string): string {
  const runsOn = laneRunsOn(state, stage);
  const where = runsOn === state.factoryWorkRunsOn ? 'Board work' : 'This lane overrides the board: work here';
  return runsOn === 'shared'
    ? `${where} runs on the Factory account, whoever owns the card.`
    : `${where} runs on each card owner's plan.`;
}

export function ModelExplain({
  state,
  facts,
  stage,
  explanation,
}: {
  state: StoryState;
  facts: CardFacts;
  stage: string;
  explanation: string;
}) {
  return (
    <StoryExplain
      title="What runs, and who pays"
      trigger={
        <button type="button" className="relative z-10 text-left">
          <Txt as="span" variant="meta" tone="faint" className="hover:text-muted-foreground transition-colors">
            Model
          </Txt>
        </button>
      }
      actions={<StorySettingsLink anchor={payerRuleAnchor(facts)} />}
    >
      <span>{explanation}</span>
      <span>{payerReason(state, facts, stage)}</span>
    </StoryExplain>
  );
}

export function BlockedExplain({
  billing,
  state,
  explanation,
}: {
  billing: Extract<Billing, { kind: 'blocked' }>;
  state: StoryState;
  explanation: string;
}) {
  const fix = blockedFix(billing.reason, billing.payer, state.viewer);
  return (
    <StoryExplain
      title="Why this card is paused"
      trigger={
        <button type="button" className="relative z-10 flex min-w-0">
          <Badge size="xs" variant="warning" icon={<TriangleAlert aria-hidden />} className="min-w-0">
            <span className="truncate">{capitalize(blockedShort(billing, state))}</span>
          </Badge>
        </button>
      }
      actions={<StorySettingsLink anchor={fix.anchor}>{fix.label}</StorySettingsLink>}
    >
      <span>{explanation}</span>
    </StoryExplain>
  );
}

export function HeldRuleRow({ label, heldLabel }: { label: ReactNode; heldLabel: string }) {
  return (
    <>
      {label}
      <RulePopover
        rule={ruleById(HOLD_NON_BUGS_RULE)}
        trigger={
          <button type="button" className="relative z-10 flex min-w-0">
            <Badge size="xs" variant="orange" emphasis="subtle" icon={<Hand aria-hidden />} className="min-w-0">
              <span className="truncate">{heldLabel}</span>
            </Badge>
          </button>
        }
      />
    </>
  );
}
