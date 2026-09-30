import { PERSONA_IDS, actorName } from './cast';
import type { Actor, PersonaId, Plan } from './cast';
import { blockedShort, capitalize, thinkingLabel } from './storyBillingCopy';
import { billingFor, ownPlansAllowed, personalPlanAllowed } from './storyState';
import type { Billing, CardFacts, StoryState } from './storyState';

export type RouteTarget = 'factory' | 'members' | 'mine';
export type RouteStatus = 'ready' | 'waiting' | 'blocked' | 'off';
export type FlowSource = 'sessions' | 'slack' | 'cards' | 'memory' | 'auto';

export type FlowRow = {
  id: string;
  source: FlowSource;
  label: string;
  model: string;
  status: RouteStatus;
  payer: RouteTarget | null;
};

export type MemberLine = { persona: PersonaId; name: string; detail: string; ok: boolean };

export type BoardBilling =
  | { kind: 'factory'; plan: Plan }
  | { kind: 'missing' }
  | { kind: 'owners'; members: MemberLine[] };

type Flow = Pick<FlowRow, 'id' | 'source' | 'label'>;

const FACTORY_CARD: CardFacts = { author: 'external', owner: 'factory', lastActor: 'factory', origin: 'board' };
const THEIR_PLAN = "Their plan's model";

function viewerCard(state: StoryState, facts: Partial<CardFacts>): CardFacts {
  return { author: state.viewer, owner: state.viewer, lastActor: state.viewer, origin: 'board', ...facts };
}

function payerTarget(payer: Actor, viewer: PersonaId): RouteTarget {
  if (payer === 'factory') return 'factory';
  return payer === viewer ? 'mine' : 'members';
}

function billedFlow(state: StoryState, flow: Flow, billing: Billing, readyModel?: string): FlowRow {
  const payer = payerTarget(billing.payer, state.viewer);
  if (billing.kind === 'ready') {
    const model = readyModel ?? `${billing.model} · ${thinkingLabel(billing.thinking)}`;
    return { ...flow, model, status: 'ready', payer };
  }
  const waiting = billing.reason === 'shared-account' || billing.reason === 'member-plan';
  return { ...flow, model: capitalize(blockedShort(billing, state)), status: waiting ? 'waiting' : 'blocked', payer };
}

function membersFlow(state: StoryState, flow: Flow): FlowRow {
  if (!state.memory.broken) return { ...flow, model: THEIR_PLAN, status: 'ready', payer: 'members' };
  const memoryFailing = blockedShort({ kind: 'blocked', payer: 'factory', reason: 'memory' }, state);
  return { ...flow, model: capitalize(memoryFailing), status: 'blocked', payer: 'members' };
}

function offFlow(flow: Flow): FlowRow {
  return { ...flow, model: 'Off', status: 'off', payer: null };
}

export function memberLine(state: StoryState, persona: PersonaId): MemberLine {
  const plan = state.memberPlans[persona];
  const name = actorName(persona);
  if (!plan) return { persona, name, detail: 'no plan · waits', ok: false };
  if (plan.disconnected) return { persona, name, detail: `${plan.label} · reconnect`, ok: false };
  if (!personalPlanAllowed(state, plan)) return { persona, name, detail: `${plan.label} · not allowed`, ok: false };
  return { persona, name, detail: plan.label, ok: true };
}

export function boardBilling(state: StoryState): BoardBilling {
  if (state.factoryWorkRunsOn === 'owner')
    return { kind: 'owners', members: PERSONA_IDS.map(persona => memberLine(state, persona)) };
  return state.sharedAccount ? { kind: 'factory', plan: state.sharedAccount } : { kind: 'missing' };
}

export function factoryConversations(state: StoryState): FlowRow[] {
  const sessions: Flow = { id: 'sessions', source: 'sessions', label: 'Personal sessions' };
  const channel: Flow = { id: 'slack-channel', source: 'slack', label: 'Channel mentions' };
  const dm: Flow = { id: 'slack-dm', source: 'slack', label: 'Direct messages' };
  return [
    !state.personalSessions
      ? offFlow(sessions)
      : ownPlansAllowed(state)
        ? membersFlow(state, sessions)
        : billedFlow(state, sessions, billingFor(state, { ...FACTORY_CARD, surface: 'chat' })),
    state.slack.channel === 'personal'
      ? membersFlow(state, channel)
      : billedFlow(state, channel, billingFor(state, { ...FACTORY_CARD, origin: 'slack-channel' })),
    state.slack.dm === 'personal' && state.personalSessions
      ? membersFlow(state, dm)
      : billedFlow(state, dm, billingFor(state, { ...FACTORY_CARD, origin: 'slack-dm' })),
  ];
}

export function backgroundRows(state: StoryState): FlowRow[] {
  const { model, broken } = state.memory;
  const memory: Flow = { id: 'memory', source: 'memory', label: 'Observational memory' };
  const auto: Flow = { id: 'auto', source: 'auto', label: 'Auto-start' };
  const memoryPayer: RouteTarget | null = state.sharedAccount ? 'factory' : null;
  const memoryRow: FlowRow = broken
    ? { ...memory, model: `${model} failing`, status: 'blocked', payer: memoryPayer }
    : { ...memory, model, status: 'ready', payer: memoryPayer };
  const autoRow = state.autoRun
    ? billedFlow(state, auto, billingFor(state, { ...FACTORY_CARD, origin: 'auto' }), 'Lane models')
    : offFlow(auto);
  return [memoryRow, autoRow];
}

export function personalConversations(state: StoryState): FlowRow[] {
  const sessions: Flow = { id: 'sessions', source: 'sessions', label: 'My sessions' };
  const dm: Flow = { id: 'slack-dm', source: 'slack', label: 'Slack DMs' };
  const cards: Flow = { id: 'cards', source: 'cards', label: 'Cards I own' };
  const conversationModel = ownPlansAllowed(state) ? undefined : state.mySessionsModel;
  const rows = [
    state.personalSessions
      ? billedFlow(state, sessions, billingFor(state, viewerCard(state, { surface: 'chat', conversationModel })))
      : offFlow(sessions),
    billedFlow(state, dm, billingFor(state, viewerCard(state, { origin: 'slack-dm', conversationModel }))),
  ];
  if (state.factoryWorkRunsOn === 'owner')
    rows.push(billedFlow(state, cards, billingFor(state, viewerCard(state, { surface: 'card' }))));
  return rows;
}
