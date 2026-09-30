import type { Actor } from './cast';
import { actorName, possessive } from './cast';
import type { Billing, BlockedReason, ComposerGate, StoryState } from './storyState';
import { billingFor, composerGate } from './storyState';

const SOURCE_LABELS: Record<Extract<Billing, { kind: 'ready' }>['source'], string> = {
  conversation: 'picked in this conversation',
  lane: 'lane model',
  pinned: 'pinned step',
  plan: 'plan default',
  session: 'kept from session',
};

function blockedLabel(reason: BlockedReason, payer: Actor): string {
  switch (reason) {
    case 'shared-account':
      return 'no Factory account';
    case 'member-plan':
      return `${possessive(payer)} plan missing`;
    case 'reconnect':
      return `${possessive(payer)} plan disconnected`;
    case 'restricted':
      return 'connection not allowed here';
    case 'memory':
      return 'memory model broken';
  }
}

function paymentLabel(billing: Billing): string {
  if (billing.kind === 'blocked') return `blocked: ${blockedLabel(billing.reason, billing.payer)}`;
  const payer = billing.payer === 'factory' ? 'Factory account' : `${possessive(billing.payer)} plan`;
  const model = billing.fallbackFrom ? `${billing.fallbackFrom} → ${billing.model}` : billing.model;
  return `pays: ${payer}, ${billing.plan.label} · ${model} (${SOURCE_LABELS[billing.source]})`;
}

function gateLabel(gate: ComposerGate): string {
  switch (gate.kind) {
    case 'own':
      return 'own session';
    case 'factory':
      return 'sending makes them owner';
    case 'steer':
      return `steers ${possessive(gate.owner)} session, ${gate.payer === 'factory' ? 'Factory account' : `${possessive(gate.payer)} plan`} pays`;
  }
}

export function focusCardSummary(state: StoryState): string | null {
  const card = state.cards[0];
  if (!card) return null;
  const billing = billingFor(state, card);
  const facts = `Owner ${actorName(card.owner)} · ${paymentLabel(billing)}`;
  if (billing.kind === 'blocked') return facts;
  return `${facts} · ${actorName(state.viewer)}: ${gateLabel(composerGate(state, card))}`;
}
