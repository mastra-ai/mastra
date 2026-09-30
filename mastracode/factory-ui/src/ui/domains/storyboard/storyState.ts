import type { Actor, PersonaId, Plan, Provider, ThinkingLevel } from './cast';
import { PLANS, providerOf } from './cast';
import { agentById } from './storyAgents';
import type { BoardLayout } from './storyBoards';
import { storyBoardLanes } from './storyBoards';
import type { StoryWorkflow } from './workflows/storyWorkflows';
import { activePin, STORY_WORKFLOWS } from './workflows/storyWorkflows';

/** Board work runs on the Factory account, or on the plan of whoever owns the card. */
export type FactoryWorkFunding = 'shared' | 'owner';
export type SlackRoute = 'factory' | 'personal';
export type AllowedConnections = { subscriptions: boolean; personalKeys: boolean; companyKeys: boolean };
export type ViewerRole = 'admin' | 'member';

export type LaneModel = { model: string; thinking: ThinkingLevel; locked?: boolean };
export type LaneRunner =
  | { kind: 'skill' }
  | { kind: 'agent'; agentId: string }
  | { kind: 'workflow'; workflowId: string };
export type OnboardingFlow = 'cloudflare' | 'small-team' | 'solo';
export type OnboardingStage = 'connect' | 'account' | 'landed';

export type CardFacts = {
  /** A board card is Factory work; a chat is someone's personal session outside the board. */
  surface?: 'card' | 'chat';
  author: PersonaId | 'external';
  owner: Actor;
  lastActor: Actor;
  origin: 'board' | 'auto' | 'slack-channel' | 'slack-dm';
  /** Pinned once someone takes ownership or moves the bill; until then the start rules decide. */
  funding?: Actor;
  movedFrom?: Actor;
  ownedFrom?: Actor;
  /** The model the session last ran on: a new payer without that provider falls back. */
  sessionModel?: { model: string; provider: Provider };
  /** Picked in this conversation's composer: wins over lane and plan defaults, for this conversation only. */
  conversationModel?: LaneModel;
  needsHuman?: boolean;
  /** Id of the rule that suggested the pending run. */
  suggestedBy?: string;
  /** A custom-board step that runs its own workflow on its own model, whoever owns the card. */
  pinned?: { model: string; provider: Provider; step: string };
  workflow?: { id: string; stepIndex: number };
  lane?: string;
  running?: boolean;
};

export type StoryState = {
  viewer: PersonaId;
  sharedAccount: Plan | null;
  /** More company keys next to the Factory account: a lane or step on their provider bills them. */
  providerKeys: Plan[];
  factoryWorkRunsOn: FactoryWorkFunding;
  laneModels: Partial<Record<string, LaneModel>>;
  /** Lanes that override who pays for board work; the rest follow `factoryWorkRunsOn`. */
  laneFunding: Partial<Record<string, FactoryWorkFunding>>;
  laneRunners: Partial<Record<string, LaneRunner>>;
  laneAuto: Partial<Record<string, boolean>>;
  boardModels: Partial<Record<string, LaneModel>>;
  viewerRole: ViewerRole;
  boardLayout: BoardLayout;
  workflows: StoryWorkflow[];
  autoRun: boolean;
  personalSessions: boolean;
  mySessionsPayer: 'mine' | 'factory';
  mySessionsModel?: LaneModel;
  allowed: AllowedConnections;
  steerHintSeen: boolean;
  slack: { channel: SlackRoute; dm: SlackRoute };
  memberPlans: Record<PersonaId, Plan | null>;
  /** Observational memory runs on its own model; when it breaks, every thread that needs it pauses. */
  memory: { model: string; broken: boolean };
  onboarding: { flow: OnboardingFlow; stage: OnboardingStage } | null;
  boardImported: boolean;
  /** Spread over the real board's cards; `cards[0]` is the one the composer shows. */
  cards: CardFacts[];
  cardFacts: Partial<Record<string, CardFacts>>;
};

export const BASE_STATE: StoryState = {
  viewer: 'shane',
  sharedAccount: PLANS.companyAnthropicKey,
  providerKeys: [],
  factoryWorkRunsOn: 'shared',
  laneModels: {},
  laneFunding: {},
  laneRunners: {},
  laneAuto: { planning: false, execute: false },
  boardModels: {},
  viewerRole: 'admin',
  boardLayout: 'standard',
  workflows: STORY_WORKFLOWS,
  autoRun: false,
  personalSessions: true,
  mySessionsPayer: 'mine',
  allowed: { subscriptions: true, personalKeys: true, companyKeys: false },
  steerHintSeen: false,
  slack: { channel: 'factory', dm: 'personal' },
  memberPlans: { shane: PLANS.claudeMax, damien: PLANS.chatgptPro, ward: PLANS.claudeMax, grayson: null },
  memory: { model: 'Haiku 4.5', broken: false },
  onboarding: null,
  boardImported: true,
  cards: [{ author: 'grayson', owner: 'ward', lastActor: 'ward', origin: 'board' }],
  cardFacts: {},
};

export function factoryKeys(state: StoryState): Plan[] {
  return state.sharedAccount ? [state.sharedAccount, ...state.providerKeys] : [];
}

export function addFactoryKey(state: StoryState, key: Plan): Partial<StoryState> {
  if (factoryKeys(state).some(existing => existing.provider === key.provider)) return {};
  return state.sharedAccount === null ? { sharedAccount: key } : { providerKeys: [...state.providerKeys, key] };
}

export function factoryKeyFor(state: StoryState, model: string): Plan | null {
  const provider = providerOf(model);
  return factoryKeys(state).find(key => key.provider === provider) ?? null;
}

export function factoryPaysPersonalSessions(state: StoryState): boolean {
  return state.sharedAccount !== null && state.allowed.companyKeys;
}

function mySessionOnFactory(state: StoryState, card: CardFacts): boolean {
  return card.owner === state.viewer && state.mySessionsPayer === 'factory' && factoryPaysPersonalSessions(state);
}

export function ownPlansAllowed(state: StoryState): boolean {
  return state.allowed.subscriptions || state.allowed.personalKeys;
}

export const COMPANY_KEYS_ONLY: Partial<StoryState> = {
  allowed: { subscriptions: false, personalKeys: false, companyKeys: true },
  factoryWorkRunsOn: 'shared',
  laneFunding: {},
  mySessionsPayer: 'factory',
  slack: { channel: 'factory', dm: 'factory' },
};

export const EACH_OWNER_PAYS: Partial<StoryState> = {
  sharedAccount: null,
  providerKeys: [],
  allowed: { subscriptions: true, personalKeys: true, companyKeys: false },
  factoryWorkRunsOn: 'owner',
  laneFunding: {},
  mySessionsPayer: 'mine',
  slack: { channel: 'personal', dm: 'personal' },
};

export function allowOwnPlans(state: StoryState): Partial<StoryState> {
  return { allowed: { ...state.allowed, subscriptions: true, personalKeys: true }, mySessionsPayer: 'mine' };
}

export function boardOfLane(state: StoryState, stage: string): string {
  return storyBoardLanes(state.boardLayout).find(board => board.lanes.some(lane => lane.stage === stage))?.id ?? 'work';
}

export function laneModelFor(
  state: StoryState,
  stage: string,
  board = boardOfLane(state, stage),
): LaneModel | undefined {
  const runner = state.laneRunners[stage];
  const agent =
    runner?.kind === 'agent' && laneRunsOn(state, stage) === 'shared' ? agentById(runner.agentId) : undefined;
  if (agent) return { model: agent.model, thinking: agent.thinking };
  return state.laneModels[stage] ?? state.boardModels[board];
}

export function laneAutoOn(state: StoryState, stage: string): boolean {
  if (laneRunsOn(state, stage) === 'owner') return false;
  return state.laneAuto[stage] ?? state.autoRun;
}

export function laneRunsOn(state: StoryState, stage?: string): FactoryWorkFunding {
  if (!ownPlansAllowed(state)) return 'shared';
  return (stage === undefined ? undefined : state.laneFunding[stage]) ?? state.factoryWorkRunsOn;
}

function startFunding(state: StoryState, card: CardFacts, stage?: string): Actor {
  if (card.owner === 'factory') return 'factory';
  switch (card.origin) {
    case 'auto':
      return 'factory';
    case 'slack-channel':
      return state.slack.channel === 'factory' ? 'factory' : card.owner;
    case 'slack-dm':
      return state.personalSessions && state.slack.dm === 'personal' ? card.owner : 'factory';
    case 'board':
      if (card.surface === 'chat') return mySessionOnFactory(state, card) ? 'factory' : card.owner;
      return laneRunsOn(state, stage) === 'owner' ? card.owner : 'factory';
  }
}

export function payerOf(state: StoryState, card: CardFacts, stage?: string): Actor {
  if (activePin(state, card) || !ownPlansAllowed(state)) return 'factory';
  return card.funding ?? startFunding(state, card, stage);
}

export function planOf(state: StoryState, actor: Actor): Plan | null {
  return actor === 'factory' ? state.sharedAccount : state.memberPlans[actor];
}

export function personalPlanAllowed(state: StoryState, plan: Plan): boolean {
  return plan.kind === 'subscription' ? state.allowed.subscriptions : state.allowed.personalKeys;
}

export type BlockedReason = 'shared-account' | 'member-plan' | 'reconnect' | 'restricted' | 'memory';

export type Billing =
  | {
      kind: 'ready';
      payer: Actor;
      plan: Plan;
      model: string;
      thinking?: ThinkingLevel;
      source: 'conversation' | 'lane' | 'pinned' | 'plan' | 'session';
      fallbackFrom?: string;
    }
  | { kind: 'blocked'; payer: Actor; reason: BlockedReason };

function modelOn(
  plan: Plan,
  card: CardFacts,
): Pick<Extract<Billing, { kind: 'ready' }>, 'model' | 'source' | 'fallbackFrom'> {
  const session = card.sessionModel;
  if (!session) return { model: plan.model, source: 'plan' };
  if (session.provider === plan.provider) return { model: session.model, source: 'session' };
  return { model: plan.model, source: 'plan', fallbackFrom: session.model };
}

type PickedModel = Pick<Extract<Billing, { kind: 'ready' }>, 'model' | 'thinking' | 'source'>;

function pickedFactoryModel(state: StoryState, card: CardFacts, stage?: string): PickedModel | undefined {
  const pin = activePin(state, card);
  if (pin) return { model: pin.model, source: 'pinned' };
  if (card.conversationModel) return { ...card.conversationModel, source: 'conversation' };
  const lane = card.surface !== 'chat' && stage ? laneModelFor(state, stage) : undefined;
  return lane && { model: lane.model, thinking: lane.thinking, source: 'lane' };
}

export function billingFor(state: StoryState, card: CardFacts, stage?: string): Billing {
  const payer = payerOf(state, card, stage);
  if (state.memory.broken) return { kind: 'blocked', payer, reason: 'memory' };

  if (payer === 'factory') {
    const plan = state.sharedAccount;
    if (!plan) return { kind: 'blocked', payer, reason: 'shared-account' };
    if (card.surface === 'chat' && !state.allowed.companyKeys) return { kind: 'blocked', payer, reason: 'restricted' };
    const picked = pickedFactoryModel(state, card, stage);
    if (!picked) return { kind: 'ready', payer, plan, ...modelOn(plan, card) };
    const key = factoryKeyFor(state, picked.model);
    if (!key) return { kind: 'ready', payer, plan, model: plan.model, source: 'plan', fallbackFrom: picked.model };
    return { kind: 'ready', payer, plan: key, ...picked };
  }

  const plan = state.memberPlans[payer];
  if (!plan) return { kind: 'blocked', payer, reason: 'member-plan' };
  if (plan.disconnected) return { kind: 'blocked', payer, reason: 'reconnect' };
  if (!personalPlanAllowed(state, plan)) return { kind: 'blocked', payer, reason: 'restricted' };
  if (card.conversationModel) return { kind: 'ready', payer, plan, ...card.conversationModel, source: 'conversation' };
  if (card.sessionModel || card.surface === 'chat' || !stage || laneRunsOn(state, stage) !== 'owner')
    return { kind: 'ready', payer, plan, ...modelOn(plan, card) };
  return { kind: 'ready', payer, plan, ...ownerLaneModel(state, plan, stage) };
}

export type OwnerLaneModel = Pick<
  Extract<Billing, { kind: 'ready' }>,
  'model' | 'thinking' | 'source' | 'fallbackFrom'
>;

export function ownerLaneModel(state: StoryState, plan: Plan, stage: string): OwnerLaneModel {
  const lane = state.laneModels[stage];
  if (!lane) return { model: plan.model, source: 'plan' };
  if (providerOf(lane.model) !== plan.provider) return { model: plan.model, source: 'plan', fallbackFrom: lane.model };
  return { model: lane.model, thinking: lane.thinking, source: 'lane' };
}

export type ComposerGate = { kind: 'own' } | { kind: 'factory' } | { kind: 'steer'; owner: PersonaId; payer: Actor };

function factoryUsable(state: StoryState, card: CardFacts): boolean {
  return state.sharedAccount !== null && (card.surface !== 'chat' || state.allowed.companyKeys);
}

function viewerPlanUsable(state: StoryState): boolean {
  const plan = state.memberPlans[state.viewer];
  return plan !== null && !plan.disconnected && personalPlanAllowed(state, plan);
}

export type StageRun =
  | { kind: 'ready'; card: CardFacts }
  | { kind: 'mine'; card: CardFacts; plan: Plan }
  | { kind: 'blocked'; reason: BlockedReason; payer: Actor };

function fundedBy(state: StoryState, card: CardFacts, funding: Actor, movedFrom: Actor): CardFacts {
  return { ...card, lastActor: state.viewer, funding, movedFrom };
}

export function stageRun(state: StoryState, card: CardFacts, stage?: string): StageRun {
  const billing = billingFor(state, card, stage);
  if (billing.kind === 'ready') return { kind: 'ready', card: { ...card, lastActor: state.viewer } };
  if (billing.reason === 'memory' || billing.payer === state.viewer)
    return { kind: 'blocked', reason: billing.reason, payer: billing.payer };
  if (factoryUsable(state, card)) return { kind: 'ready', card: fundedBy(state, card, 'factory', billing.payer) };
  const plan = state.memberPlans[state.viewer];
  if (plan && viewerPlanUsable(state))
    return { kind: 'mine', plan, card: fundedBy(state, card, state.viewer, billing.payer) };
  return { kind: 'blocked', reason: billing.reason, payer: billing.payer };
}

export function composerGate(state: StoryState, card: CardFacts): ComposerGate {
  if (card.owner === state.viewer) return { kind: 'own' };
  if (card.owner === 'factory') return { kind: 'factory' };
  return { kind: 'steer', owner: card.owner, payer: payerOf(state, card) };
}

/** Ownership moves; a personal bill never follows it to someone else. */
export function takeOwnership(state: StoryState, card: CardFacts): CardFacts {
  const payer = payerOf(state, card);
  return {
    ...card,
    owner: state.viewer,
    lastActor: state.viewer,
    ownedFrom: card.owner,
    funding: payer === 'factory' ? 'factory' : undefined,
  };
}

/** Null when the viewer has no plan this session may run on. */
export function moveToMyPlan(state: StoryState, card: CardFacts): CardFacts | null {
  const payer = payerOf(state, card);
  const plan = state.memberPlans[state.viewer];
  const personalAllowedHere = card.surface === 'chat' ? state.personalSessions : state.factoryWorkRunsOn === 'owner';
  if (activePin(state, card) || payer === state.viewer || !plan || plan.disconnected) return null;
  if (!personalAllowedHere || !personalPlanAllowed(state, plan)) return null;
  return {
    ...card,
    owner: state.viewer,
    lastActor: state.viewer,
    ownedFrom: card.owner,
    funding: state.viewer,
    movedFrom: payer,
  };
}

/** Null when there is no Factory account, or company keys are kept to board work. */
export function moveToFactory(state: StoryState, card: CardFacts): CardFacts | null {
  const payer = payerOf(state, card);
  if (payer === 'factory' || !state.sharedAccount) return null;
  if (card.surface === 'chat' && !state.allowed.companyKeys) return null;
  return { ...card, funding: 'factory', movedFrom: payer };
}

/** Auto-start needs someone to bill when no person is around: the Factory account. */
export function autoRunBlocked(state: StoryState): boolean {
  return state.autoRun && state.sharedAccount === null;
}

export function cardIndexFor(itemId: string, count: number): number {
  let hash = 0;
  for (const char of itemId) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return Math.abs(hash) % count;
}
