import { possessive } from './cast';
import type { Actor, PersonaId, Plan } from './cast';
import { billedTo, blockedShort, capitalize } from './storyBillingCopy';
import type { SettingsAnchor } from './storyLinks';
import { billingFor, composerGate, takeOwnership } from './storyState';
import type { Billing, CardFacts, StoryState } from './storyState';

export type BlockedBilling = Extract<Billing, { kind: 'blocked' }>;

export type ComposerTopTray = { kind: 'blocked'; billing: BlockedBilling } | { kind: 'steer-hint'; owner: PersonaId };

export function composerBilling(state: StoryState, card: CardFacts): Billing {
  return billingFor(state, card, card.lane);
}

export function lockedLaneModel(state: StoryState, card: CardFacts): string | null {
  const lane = card.lane === undefined ? undefined : state.laneModels[card.lane];
  return lane?.locked ? lane.model : null;
}

export function composerTopTray(state: StoryState, card: CardFacts): ComposerTopTray | null {
  const billing = composerBilling(state, card);
  if (billing.kind === 'blocked') return { kind: 'blocked', billing };
  const gate = composerGate(state, card);
  return gate.kind === 'steer' && !state.steerHintSeen ? { kind: 'steer-hint', owner: gate.owner } : null;
}

export type ComposerPayer = { kind: 'ready'; payer: Actor; plan: Plan } | { kind: 'blocked'; billing: BlockedBilling };

export function composerPayer(state: StoryState, card: CardFacts): ComposerPayer {
  const billing = composerBilling(state, card);
  return billing.kind === 'blocked'
    ? { kind: 'blocked', billing }
    : { kind: 'ready', payer: billing.payer, plan: billing.plan };
}

export function composerLocked(state: StoryState, card: CardFacts): boolean {
  return composerBilling(state, card).kind === 'blocked';
}

export type ComposerFooter = { kind: 'takeover'; from: Actor } | { kind: 'steer'; owner: PersonaId; payer: Actor };

export function composerFooter(state: StoryState, card: CardFacts): ComposerFooter | null {
  const billing = composerBilling(state, card);
  if (billing.kind === 'blocked') return null;
  const gate = composerGate(state, card);
  if (gate.kind === 'factory') return { kind: 'takeover', from: card.owner };
  if (gate.kind === 'steer') return { kind: 'steer', owner: gate.owner, payer: billing.payer };
  return null;
}

export function steeringLine(state: StoryState, owner: PersonaId, payer: Actor): string {
  return `You’re steering ${possessive(owner)} session · ${capitalize(billedTo(state, payer))} pays`;
}

export function borrowedPlanOwner(state: StoryState, billing: Billing): PersonaId | null {
  if (billing.kind === 'blocked' || billing.payer === 'factory' || billing.payer === state.viewer) return null;
  return billing.payer;
}

export function modelChangeGuarded(card: CardFacts): boolean {
  return card.running === true;
}

export function takeOwnershipEffects(state: StoryState, card: CardFacts): string[] {
  const before = composerBilling(state, card);
  const after = composerBilling(state, takeOwnership(state, card));
  const bill =
    after.kind === 'blocked'
      ? `Paused once it’s yours: ${blockedShort(after, state)}.`
      : after.payer === before.payer
        ? `Billing stays on ${billedTo(state, after.payer)}.`
        : `Billing moves to ${billedTo(state, after.payer)}.`;
  const models =
    after.kind === 'ready' && after.payer === state.viewer
      ? `Your models: ${after.fallbackFrom ? `${after.fallbackFrom} → ${after.model}` : after.model}.`
      : null;
  return [bill, models, 'The prompt cache restarts: the next turn re-reads the whole thread.'].filter(
    line => line !== null,
  );
}

export function payerRuleAnchor(card: CardFacts): SettingsAnchor {
  if (card.origin === 'slack-channel' || card.origin === 'slack-dm') return 'slack';
  return card.surface === 'chat' ? 'personal-sessions' : 'factory-work';
}
