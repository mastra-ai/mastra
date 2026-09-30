import { THINKING_LEVELS, possessive } from './cast';
import type { Actor, ThinkingLevel } from './cast';
import { billingFor, planOf } from './storyState';
import type { Billing, CardFacts, StoryState } from './storyState';

export function whose(actor: Actor, viewer: Actor): string {
  if (actor === viewer) return 'your';
  return actor === 'factory' ? "the Factory account's" : possessive(actor);
}

export function capitalize(text: string): string {
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

export const PLAN_THINKING: ThinkingLevel = 'medium';

export function thinkingLabel(level: ThinkingLevel | undefined): string {
  const effective = level ?? PLAN_THINKING;
  return THINKING_LEVELS.find(entry => entry.value === effective)?.label ?? effective;
}

export function billedTo(state: StoryState, payer: Actor): string {
  if (payer === 'factory') return 'the Factory account';
  const plan = state.memberPlans[payer];
  return `${whose(payer, state.viewer)} ${plan?.label ?? 'plan'}`;
}

export const SOURCE_LABELS: Record<Extract<Billing, { kind: 'ready' }>['source'], string> = {
  conversation: 'picked in this conversation',
  lane: 'lane default',
  session: 'the model this session last ran',
  plan: 'the payer’s plan default',
  pinned: 'pinned by the workflow',
};

export function blockedShort(billing: Extract<Billing, { kind: 'blocked' }>, state: StoryState): string {
  const plan = planOf(state, billing.payer);
  switch (billing.reason) {
    case 'memory':
      return `memory model ${state.memory.model} failing`;
    case 'shared-account':
      return 'no Factory account';
    case 'member-plan':
      return billing.payer === state.viewer ? 'you have no plan' : `${whose(billing.payer, state.viewer)} plan missing`;
    case 'reconnect':
      return `reconnect ${plan?.label ?? 'plan'}`;
    case 'restricted':
      return billing.payer === 'factory' ? 'company keys restricted' : `${plan?.label ?? 'plan'} not allowed here`;
  }
}

export function slackReply(state: StoryState, card: CardFacts): string {
  const billing = billingFor(state, card);
  if (billing.kind === 'blocked') return `Paused · ${blockedShort(billing, state)}`;
  const where = billing.payer === 'factory' ? 'Factory' : `${possessive(billing.payer)} session`;
  const plan = billing.payer === 'factory' ? 'Factory account' : billing.plan.label;
  return `Running in ${where} · ${plan} · ${billing.model}`;
}
