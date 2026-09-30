import { Button, buttonVariants } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@mastra/playground-ui/components/Command';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ArrowRight, Check, ChevronDown, Lock, RotateCcw, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type { ReactNode } from 'react';

import { stageLabel } from '../factory/stages';
import { ProviderBrandIcon } from '../workspaces/components/ProviderBrandIcon';
import { providerDisplayName } from '../settings/components/provider-display-name';
import { modelsOn, possessive, PROVIDERS, THINKING_LEVELS } from './cast';
import type { PersonaId, Provider } from './cast';
import { useStoryboard } from './StoryboardProvider';
import type { Storyboard } from './StoryboardProvider';
import { PLAN_THINKING, SOURCE_LABELS, blockedShort, thinkingLabel } from './storyBillingCopy';
import { borrowedPlanOwner, composerBilling, lockedLaneModel, modelChangeGuarded } from './storyComposer';
import { storyLane } from './storyBoards';
import { storySettingsPath } from './storyLinks';
import { StoryPayerChip } from './StoryPayerChip';
import { billingFor, factoryKeys } from './storyState';
import type { Billing, CardFacts, LaneModel, StoryState } from './storyState';

type ReadyBilling = Extract<Billing, { kind: 'ready' }>;

function chipLabel(billing: Billing): string {
  return billing.kind === 'blocked' ? 'Paused' : `${billing.model} · ${thinkingLabel(billing.thinking)}`;
}

function chipDescription(billing: Billing, state: StoryState): string {
  return billing.kind === 'blocked' ? `paused, ${blockedShort(billing, state)}` : chipLabel(billing);
}

function modelProvider(billing: Billing, card: CardFacts): string | null {
  if (billing.kind === 'blocked') return null;
  return billing.source === 'pinned' && card.pinned ? card.pinned.provider : billing.plan.provider;
}

function defaultLine(state: StoryState, card: CardFacts): string {
  const fallback = billingFor(state, { ...card, conversationModel: undefined }, card.lane);
  if (fallback.kind === 'blocked') return 'nothing can run right now';
  return `${fallback.model} · ${thinkingLabel(fallback.thinking)} (${SOURCE_LABELS[fallback.source]})`;
}

function ConversationPicker({
  storyboard,
  card,
  billing,
  close,
}: {
  storyboard: Storyboard;
  card: CardFacts;
  billing: ReadyBilling;
  close: () => void;
}) {
  const laneModel = lockedLaneModel(storyboard.state, card);
  const setConversationModel = (conversationModel: LaneModel | undefined) => {
    storyboard.patchCard(0, { ...card, conversationModel });
    close();
  };
  const pick = (change: Partial<LaneModel>) =>
    setConversationModel({ model: billing.model, thinking: billing.thinking ?? PLAN_THINKING, ...change });
  const checked = (on: boolean) => (on ? <Check aria-hidden className="ml-auto shrink-0" /> : null);
  const factoryPays = billing.payer === 'factory';
  const plans = factoryPays ? factoryKeys(storyboard.state) : [billing.plan];

  return (
    <CommandList className="max-h-80">
      {plans.map(plan => (
        <CommandGroup key={plan.label} heading={plan.label}>
          {modelsOn(plan).map(model => (
            <CommandItem key={model} value={`model:${model}`} onSelect={() => pick({ model })}>
              <ProviderBrandIcon provider={plan.provider} />
              <span className="truncate">{model}</span>
              {model === laneModel && (
                <span className="text-muted-foreground flex items-center gap-1 text-xs">
                  <Lock aria-hidden size={11} />
                  Lane
                </span>
              )}
              {checked(billing.model === model)}
            </CommandItem>
          ))}
        </CommandGroup>
      ))}
      <OtherProviders
        covered={plans.map(plan => plan.provider)}
        factoryPays={factoryPays}
        borrowedFrom={borrowedPlanOwner(storyboard.state, billing)}
      />
      <CommandGroup heading="Thinking">
        {THINKING_LEVELS.map(level => (
          <CommandItem
            key={level.value}
            value={`thinking:${level.value}`}
            onSelect={() => pick({ thinking: level.value })}
          >
            <span>{level.label}</span>
            {checked((billing.thinking ?? PLAN_THINKING) === level.value)}
          </CommandItem>
        ))}
      </CommandGroup>
      {card.conversationModel && (
        <>
          <CommandSeparator />
          <CommandGroup>
            <CommandItem value="action:reset" onSelect={() => setConversationModel(undefined)}>
              <RotateCcw aria-hidden />
              <span>Back to the default</span>
            </CommandItem>
          </CommandGroup>
        </>
      )}
    </CommandList>
  );
}

function OtherProviders({
  covered,
  factoryPays,
  borrowedFrom,
}: {
  covered: Provider[];
  factoryPays: boolean;
  borrowedFrom: PersonaId | null;
}) {
  const navigate = useNavigate();
  const { factoryId = '' } = useParams<{ factoryId: string }>();
  const missing = PROVIDERS.filter(provider => !covered.includes(provider));
  if (missing.length === 0) return null;
  const settings = storySettingsPath(factoryId, factoryPays ? 'factory-work' : 'my-plan');
  if (borrowedFrom)
    return (
      <CommandGroup heading="Other providers">
        {missing.map(provider => (
          <CommandItem key={provider} value={`needs:${provider}`} disabled>
            <ProviderBrandIcon provider={provider} />
            <span className="truncate">{providerDisplayName(provider)}</span>
            <span className="text-muted-foreground ml-auto shrink-0 text-xs">
              needs {possessive(borrowedFrom)} account
            </span>
          </CommandItem>
        ))}
      </CommandGroup>
    );
  return (
    <CommandGroup heading="Other providers">
      {missing.map(provider => (
        <CommandItem key={provider} value={`connect:${provider}`} onSelect={() => navigate(settings)}>
          <ProviderBrandIcon provider={provider} />
          <span className="truncate">
            {factoryPays
              ? `Add a company ${providerDisplayName(provider)} key`
              : `Connect ${providerDisplayName(provider)}`}
          </span>
          <ArrowRight aria-hidden className="text-muted-foreground ml-auto shrink-0" />
        </CommandItem>
      ))}
    </CommandGroup>
  );
}

function PickerOrReason({
  storyboard,
  card,
  billing,
  close,
}: {
  storyboard: Storyboard;
  card: CardFacts;
  billing: Billing;
  close: () => void;
}) {
  const reason =
    billing.kind === 'blocked'
      ? `Paused: ${blockedShort(billing, storyboard.state)}. Nothing runs until that is fixed.`
      : billing.source === 'pinned'
        ? `Pinned by the ${card.pinned?.step ?? 'workflow'}: this step can’t change model or thinking.`
        : null;
  if (billing.kind === 'blocked' || reason) {
    return (
      <Txt as="p" variant="caption" tone="muted" className="px-3 py-2">
        {reason}
      </Txt>
    );
  }
  return (
    <Command loop>
      <ConversationPicker storyboard={storyboard} card={card} billing={billing} close={close} />
    </Command>
  );
}

function RunningLock({ unlock }: { unlock: () => void }) {
  return (
    <div className="flex flex-col items-start gap-2 px-3 py-2">
      <Txt as="p" variant="caption" tone="muted">
        The agent is running, so its model is locked. Changing it breaks the prompt cache and applies next turn.
      </Txt>
      <Button size="sm" variant="ghost" onClick={unlock}>
        <Lock aria-hidden />
        Unlock and change model
      </Button>
    </div>
  );
}

function laneName(state: StoryState, stage: string): string {
  return storyLane(state.boardLayout, stage)?.label ?? stageLabel(stage);
}

type LaneOverride = { lane: string; model: string };

function laneOverride(state: StoryState, card: CardFacts, billing: Billing): LaneOverride | null {
  const model = lockedLaneModel(state, card);
  if (!card.lane || !model || billing.kind === 'blocked' || billing.model === model) return null;
  return { lane: laneName(state, card.lane), model };
}

function LaneOverrideWarning({ override }: { override: LaneOverride }) {
  return (
    <Txt as="p" variant="meta" className="text-warning-indicator flex items-start gap-1.5 px-3 pt-1">
      <TriangleAlert aria-hidden size={12} className="mt-0.5 shrink-0" />
      {override.lane} asks for {override.model}. This conversation will differ.
    </Txt>
  );
}

function Facts({ state, card, billing }: { state: StoryState; card: CardFacts; billing: Billing }) {
  const rows: [string, string][] = [
    ['Source', billing.kind === 'ready' ? SOURCE_LABELS[billing.source] : blockedShort(billing, state)],
    ['Default', defaultLine(state, card)],
  ];
  if (billing.kind === 'ready' && billing.fallbackFrom)
    rows.push(['Fallback', `${billing.fallbackFrom} is not on ${billing.plan.label}, so ${billing.model} runs`]);
  return (
    <div className="border-border flex flex-col gap-1 border-t px-3 py-2">
      {rows.map(([label, value]) => (
        <Txt key={label} as="span" variant="meta" tone="muted">
          <span className="text-foreground">{label}</span> · {value}
        </Txt>
      ))}
      <Txt variant="meta" tone="faint">
        Applies to this conversation only. The lane default and other threads keep theirs.
      </Txt>
    </div>
  );
}

export function StoryModelChip({ children }: { children: ReactNode }) {
  const storyboard = useStoryboard();
  const [open, setOpen] = useState(false);
  const [unlockedFor, setUnlockedFor] = useState<CardFacts | null>(null);
  const card = storyboard?.state.cards[0];
  if (!storyboard || !card) return children;

  const { state } = storyboard;
  const billing = composerBilling(state, card);
  const provider = modelProvider(billing, card);
  const override = laneOverride(state, card, billing);
  const locked = modelChangeGuarded(card) && billing.kind === 'ready' && unlockedFor !== card;
  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next) setUnlockedFor(null);
  };

  return (
    <ButtonsGroup size="sm" aria-label="Model and who pays">
      <Popover open={open} onOpenChange={changeOpen}>
        <PopoverTrigger
          type="button"
          aria-label={`Conversation model: ${chipDescription(billing, state)}${locked ? ', locked while the agent runs' : ''}`}
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            billing.kind === 'blocked' ? 'text-destructive-indicator' : 'text-muted-foreground',
          )}
        >
          {provider && <ProviderBrandIcon provider={provider} />}
          <span className="max-w-48 truncate">{chipLabel(billing)}</span>
          {override && <TriangleAlert aria-label="Differs from the lane model" className="text-warning-indicator" />}
          {locked ? <Lock aria-hidden size={12} /> : <ChevronDown aria-hidden size={12} />}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-0">
          <Txt as="p" variant="label" tone="ink" className="px-3 pt-2">
            This conversation
          </Txt>
          {override && <LaneOverrideWarning override={override} />}
          {locked ? (
            <RunningLock unlock={() => setUnlockedFor(card)} />
          ) : (
            <PickerOrReason storyboard={storyboard} card={card} billing={billing} close={() => changeOpen(false)} />
          )}
          <Facts state={state} card={card} billing={billing} />
        </PopoverContent>
      </Popover>
      <StoryPayerChip storyboard={storyboard} card={card} />
    </ButtonsGroup>
  );
}
