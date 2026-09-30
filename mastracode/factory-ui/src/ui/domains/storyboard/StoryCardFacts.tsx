import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { ProviderLogo } from '@mastra/playground-ui/domains/llm/provider-logo';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Factory, History, Pin } from 'lucide-react';
import type { ReactNode } from 'react';

import { stageLabel } from '../factory/stages';
import type { Actor } from './cast';
import { actorName, possessive, providerOf } from './cast';
import { thinkingLabel } from './storyBillingCopy';
import { StoryCardChips } from './StoryCardChips';
import { BlockedExplain, HeldRuleRow, ModelExplain } from './StoryCardExplainers';
import { ActorGlyph } from './StoryPayerChip';
import { useStoryCard } from './StoryboardProvider';
import type { Billing, BlockedReason } from './storyState';
import { billingFor } from './storyState';
import { WorkflowRow } from './workflows/WorkflowFlow';
import { activePin, onWorkflowLane } from './workflows/storyWorkflows';

type ReadyBilling = Extract<Billing, { kind: 'ready' }>;

const OWNER_EXPLANATION = 'Who answers for the card. Not necessarily who pays for its runs, and not the last activity.';

function blockedExplanation(reason: BlockedReason, payer: Actor): string {
  switch (reason) {
    case 'shared-account':
      return 'Factory work bills the Factory account, and none is connected.';
    case 'member-plan':
      return `${actorName(payer)} has no plan connected.`;
    case 'reconnect':
      return `${possessive(payer)} subscription is disconnected. The run pauses until it is reconnected, never falling back to a company key.`;
    case 'restricted':
      return 'This kind of connection is not allowed for this session.';
    case 'memory':
      return 'The observational memory model is failing: this thread pauses until it is fixed.';
  }
}

function modelExplanation(billing: ReadyBilling, pinnedStep: string | undefined, stage: string): string {
  if (billing.source === 'lane') return `${stageLabel(stage)} lane model, on the Factory account.`;
  if (billing.source === 'conversation') return "Picked in this conversation's composer: applies to it only.";
  if (billing.source === 'pinned')
    return `Pinned to the ${pinnedStep}: bills the Factory account, whoever owns the card.`;
  if (billing.source === 'session') return 'Keeps the model the session last ran on.';
  if (billing.fallbackFrom) return `${billing.fallbackFrom} is not on this plan: falls back to its default.`;
  return "The plan's default model.";
}

function payingLabel(billing: ReadyBilling): string {
  return billing.payer === 'factory' ? billing.plan.label : `${possessive(billing.payer)} ${billing.plan.label}`;
}

function modelLine(billing: ReadyBilling): string {
  return billing.thinking ? `${billing.model} · ${thinkingLabel(billing.thinking)}` : billing.model;
}

function ActorAvatar({ actor }: { actor: Actor }) {
  if (actor !== 'factory') return <Avatar name={actorName(actor)} size="sm" />;
  return (
    <span className="border-border bg-fill text-muted-foreground h-avatar-sm w-avatar-sm flex shrink-0 items-center justify-center rounded-full border">
      <Factory size={12} aria-hidden />
    </span>
  );
}

function ExplainedLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Txt
            as="span"
            variant="meta"
            tone="faint"
            tabIndex={0}
            className="hover:text-muted-foreground relative z-10 transition-colors"
          >
            {label}
          </Txt>
        }
      />
      <TooltipContent side="bottom" className="flex max-w-64 flex-col gap-1">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

function ModelValue({ billing }: { billing: ReadyBilling }) {
  const provider = providerOf(billing.model) ?? billing.plan.provider;
  return (
    <Txt as="span" variant="meta" tone="muted" className="flex min-w-0 items-center gap-1.5">
      <ProviderLogo providerId={provider} size={12} />
      <span className="text-foreground shrink-0">{modelLine(billing)}</span>
      {billing.source === 'pinned' && <Pin size={11} className="shrink-0" aria-label="Pinned model" />}
      {billing.fallbackFrom && <span className="text-warning-indicator shrink-0">was {billing.fallbackFrom}</span>}
      <span aria-hidden>·</span>
      <ActorGlyph actor={billing.payer} />
      <span className="truncate">{payingLabel(billing)}</span>
    </Txt>
  );
}

export function StoryCardFacts({
  itemId,
  columnStage,
  heldLabel,
}: {
  itemId: string;
  columnStage: string;
  heldLabel: string | null;
}) {
  const story = useStoryCard(itemId);
  if (story === null) return null;
  const { storyboard } = story;
  const facts = onWorkflowLane(storyboard.state, story.facts, columnStage);
  const billing = billingFor(storyboard.state, facts, columnStage);
  const author = facts.author === 'external' ? 'someone outside the team' : actorName(facts.author);
  const explanation =
    billing.kind === 'blocked'
      ? blockedExplanation(billing.reason, billing.payer)
      : modelExplanation(billing, activePin(storyboard.state, facts)?.step, columnStage);

  return (
    <div className="flex min-w-0 flex-col gap-1.5" data-testid="story-card-facts">
      <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1">
        <ExplainedLabel label="Owner">
          <span>{OWNER_EXPLANATION}</span>
        </ExplainedLabel>
        <Txt as="span" variant="meta" tone="muted" className="flex min-w-0 items-center gap-1.5">
          <ActorAvatar actor={facts.owner} />
          <span className="text-foreground shrink-0">{actorName(facts.owner)}</span>
          <span className="truncate">· opened by {author}</span>
        </Txt>
        <ModelExplain state={storyboard.state} facts={facts} stage={columnStage} explanation={explanation} />
        {billing.kind === 'blocked' ? (
          <BlockedExplain billing={billing} state={storyboard.state} explanation={explanation} />
        ) : (
          <ModelValue billing={billing} />
        )}
        <WorkflowRow state={storyboard.state} facts={facts} stage={columnStage} />
        {heldLabel && (
          <HeldRuleRow
            heldLabel={heldLabel}
            label={
              <Txt as="span" variant="meta" tone="faint">
                Rule
              </Txt>
            }
          />
        )}
      </div>
      <StoryCardChips facts={facts} />
    </div>
  );
}

export function StoryLastActivity({ itemId, fallback }: { itemId: string; fallback: ReactNode }) {
  const story = useStoryCard(itemId);
  if (story === null) return fallback;
  const name = actorName(story.facts.lastActor);
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            tabIndex={0}
            aria-label={`Last activity: ${name}`}
            className="text-muted-foreground relative z-10 flex min-w-0 items-center gap-1.5 rounded-full"
          >
            <History size={12} className="shrink-0" aria-hidden />
            <Txt as="span" variant="meta" className="max-w-32 truncate">
              {name}
            </Txt>
            <ActorAvatar actor={story.facts.lastActor} />
          </span>
        }
      />
      <TooltipContent side="bottom">Last activity: {name}</TooltipContent>
    </Tooltip>
  );
}
