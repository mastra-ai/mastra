import { describe, expect, it } from 'vitest';

import { companyKeyFor, PLANS } from './cast';
import { STORIES, storyState } from './stories';
import type { CardFacts, StoryState } from './storyState';
import {
  autoRunBlocked,
  BASE_STATE,
  billingFor,
  COMPANY_KEYS_ONLY,
  composerGate,
  addFactoryKey,
  factoryKeyFor,
  factoryKeys,
  moveToFactory,
  moveToMyPlan,
  payerOf,
  stageRun,
  takeOwnership,
} from './storyState';

function stepState(storyId: string, stepIndex: number): StoryState {
  const story = STORIES.find(candidate => candidate.id === storyId);
  if (!story) throw new Error(`No story ${storyId}`);
  return storyState(story, stepIndex);
}

function focusCard(state: StoryState) {
  const card = state.cards[0];
  if (!card) throw new Error('Story step has no cards');
  return card;
}

describe('storyboard stories resolve to what their narration claims', () => {
  it('lets anyone steer a card the Factory account pays for, without taking it', () => {
    const state = stepState('who-is-who', 1);
    expect(composerGate(state, focusCard(state))).toEqual({ kind: 'steer', owner: 'ward', payer: 'factory' });
    expect(billingFor(state, focusCard(state))).toMatchObject({ payer: 'factory' });
  });

  it('keeps the bill on the Factory account when someone takes ownership', () => {
    const state = stepState('auto-run-stuck', 1);
    expect(composerGate(state, focusCard(state))).toEqual({ kind: 'factory' });
    const owned = takeOwnership(state, focusCard(state));
    expect(owned.owner).toBe('shane');
    expect(billingFor(state, owned)).toMatchObject({ payer: 'factory' });
  });

  it('never lets a new owner inherit the previous owner’s plan', () => {
    const state = stepState('teammates-plan', 0);
    const owned = takeOwnership(state, focusCard(state));
    expect(billingFor(state, owned)).toMatchObject({ payer: 'shane' });
  });

  it('lets anyone steer a teammate’s session on the plan it started on, without a setting', () => {
    const state = stepState('teammates-plan', 0);
    expect(composerGate(state, focusCard(state))).toEqual({ kind: 'steer', owner: 'ward', payer: 'ward' });
    expect(billingFor(state, focusCard(state))).toMatchObject({ kind: 'ready', payer: 'ward' });
  });

  it('moves the bill off Ward without changing the owner', () => {
    const state = stepState('teammates-plan', 0);
    const moved = moveToFactory(state, focusCard(state));
    expect(moved?.owner).toBe('ward');
    expect(moved && billingFor(state, moved)).toMatchObject({ payer: 'factory', model: 'Opus 5.5' });
  });

  it('falls back to the new payer’s own provider on handoff', () => {
    const state = stepState('handoff', 0);
    const moved = moveToMyPlan(state, focusCard(state));
    expect(moved && billingFor(state, moved)).toMatchObject({
      payer: 'damien',
      model: 'GPT-5',
      fallbackFrom: 'Opus 5.5',
    });
  });

  it('keeps company keys out of personal sessions unless allowed', () => {
    const state = stepState('mixed-company', 3);
    expect(billingFor(state, focusCard(state))).toEqual({ kind: 'blocked', payer: 'factory', reason: 'restricted' });
    const allowed = { ...state, allowed: { ...state.allowed, companyKeys: true } };
    expect(billingFor(allowed, focusCard(allowed))).toMatchObject({ kind: 'ready', payer: 'factory' });
  });

  it('refuses personal keys when only subscriptions are allowed', () => {
    const state = stepState('mixed-company', 2);
    const onKey = { ...state, memberPlans: { ...state.memberPlans, damien: PLANS.personalAnthropicKey } };
    expect(billingFor(onKey, focusCard(onKey))).toEqual({ kind: 'blocked', payer: 'damien', reason: 'restricted' });
  });

  it('uses lane model and thinking for board work the Factory account pays', () => {
    const state = stepState('mixed-company', 1);
    expect(billingFor(state, focusCard(state), 'review')).toMatchObject({ model: 'Opus 5.5', thinking: 'xhigh' });
  });

  it('pauses a disconnected subscription instead of falling back to the company', () => {
    const state = stepState('subscription-disconnected', 0);
    expect(billingFor(state, focusCard(state))).toEqual({ kind: 'blocked', payer: 'damien', reason: 'reconnect' });
  });

  it('pauses auto-start without a Factory account until one is connected', () => {
    expect(autoRunBlocked(stepState('small-team', 0))).toBe(true);
    expect(autoRunBlocked(stepState('small-team', 2))).toBe(false);
  });

  it('routes Slack by destination and keeps a thread on the plan it started on', () => {
    const channel = stepState('slack', 0);
    expect(billingFor(channel, focusCard(channel))).toMatchObject({ payer: 'factory' });
    const dm = stepState('slack', 1);
    expect(billingFor(dm, focusCard(dm))).toMatchObject({ payer: 'damien' });
    const reply = stepState('slack', 2);
    expect(composerGate(reply, focusCard(reply))).toEqual({ kind: 'steer', owner: 'damien', payer: 'damien' });
    const noPersonal = stepState('slack', 3);
    expect(billingFor(noPersonal, focusCard(noPersonal))).toMatchObject({ payer: 'factory' });
  });

  it('runs a conversation-picked model over the lane default, for that conversation only', () => {
    const state = stepState('conversation-model', 1);
    expect(billingFor(state, focusCard(state), 'review')).toMatchObject({
      model: 'Sonnet 5.5',
      thinking: 'low',
      source: 'conversation',
    });
  });

  it('pauses every thread while the memory model is broken, and resumes once it is fixed', () => {
    const broken = stepState('memory-broken', 0);
    expect(billingFor(broken, focusCard(broken))).toEqual({ kind: 'blocked', payer: 'factory', reason: 'memory' });
    const fixed = stepState('memory-broken', 1);
    expect(billingFor(fixed, focusCard(fixed))).toMatchObject({ kind: 'ready' });
  });

  it('bills pinned workflow steps to the Factory account whoever owns the card', () => {
    const state = stepState('custom-board', 2);
    expect(billingFor(state, focusCard(state))).toMatchObject({
      payer: 'factory',
      model: 'DeepSeek V4',
      plan: { label: 'Company DeepSeek key' },
    });
  });

  it('falls back to the Factory default model when no company key covers the picked provider', () => {
    const state = { ...stepState('custom-board', 2), providerKeys: [] };
    expect(billingFor(state, focusCard(state))).toMatchObject({
      model: 'Sonnet 5.5',
      fallbackFrom: 'DeepSeek V4',
      plan: { label: 'Company Anthropic key' },
    });
  });

  it('hands the bill back to the owner once the workflow leaves its pinned step', () => {
    const state = stepState('custom-board', 2);
    const signOff = { ...focusCard(state), workflow: { id: 'security-review', stepIndex: 2 } };
    expect(billingFor(state, signOff)).toMatchObject({ payer: 'shane', model: 'Opus 5.5' });
  });
});

describe('who pays for my own sessions', () => {
  const mySession = (state: StoryState) =>
    billingFor(state, {
      author: state.viewer,
      owner: state.viewer,
      lastActor: state.viewer,
      origin: 'board',
      surface: 'chat',
    });

  it('moves my sessions to the Factory account only while the Factory allows company keys', () => {
    const base = stepState('mixed-company', 0);
    const preferFactory: StoryState = { ...base, mySessionsPayer: 'factory', sharedAccount: PLANS.companyAnthropicKey };

    expect(mySession({ ...preferFactory, allowed: { ...base.allowed, companyKeys: true } }).payer).toBe('factory');
    expect(mySession({ ...preferFactory, allowed: { ...base.allowed, companyKeys: false } }).payer).toBe(base.viewer);
  });
});

describe('who pays per lane', () => {
  const wardsCard: CardFacts = { author: 'grayson', owner: 'ward', lastActor: 'ward', origin: 'board' };
  const board = (factoryWorkRunsOn: StoryState['factoryWorkRunsOn'], triage?: 'shared' | 'owner'): StoryState => ({
    ...BASE_STATE,
    factoryWorkRunsOn,
    laneModels: { triage: { model: 'Haiku 4.5', thinking: 'low' } },
    laneFunding: { triage },
  });

  it('runs the lane default on the owner’s plan when their provider covers it', () => {
    expect(billingFor(board('owner'), wardsCard, 'triage')).toMatchObject({
      payer: 'ward',
      model: 'Haiku 4.5',
      thinking: 'low',
    });
  });

  it('falls back to the owner’s plan model when their provider cannot run the lane default', () => {
    const damiensCard: CardFacts = { ...wardsCard, owner: 'damien', lastActor: 'damien' };
    expect(billingFor(board('owner'), damiensCard, 'triage')).toMatchObject({
      payer: 'damien',
      model: 'GPT-5',
      fallbackFrom: 'Haiku 4.5',
    });
  });

  it('runs the lane model on the Factory key when the lane overrides an owner-pays board', () => {
    expect(billingFor(board('owner', 'shared'), wardsCard, 'triage')).toMatchObject({
      payer: 'factory',
      model: 'Haiku 4.5',
      plan: { label: 'Company Anthropic key' },
    });
  });

  it('bills the card owner when the lane overrides a Factory-paid board', () => {
    expect(billingFor(board('shared', 'owner'), wardsCard, 'triage')).toMatchObject({ payer: 'ward' });
    expect(billingFor(board('shared', 'owner'), wardsCard, 'planning')).toMatchObject({ payer: 'factory' });
  });
});

describe('what can pay for work', () => {
  const wardsCard: CardFacts = { author: 'ward', owner: 'ward', lastActor: 'ward', origin: 'board' };

  it('never bills an owner when the Factory runs on company keys only', () => {
    const state: StoryState = { ...BASE_STATE, ...COMPANY_KEYS_ONLY, laneFunding: { triage: 'owner' } };
    expect(billingFor(state, wardsCard, 'triage')).toMatchObject({ payer: 'factory' });
    expect(billingFor(state, { ...wardsCard, funding: 'ward', surface: 'chat' })).toMatchObject({ payer: 'factory' });
  });
});

describe('connecting a provider from a lane', () => {
  it('bills a registry model to its provider and never adds the same provider twice', () => {
    const drun = companyKeyFor('drun');
    const withDrun = { ...BASE_STATE, ...addFactoryKey(BASE_STATE, drun) };
    expect(factoryKeyFor(withDrun, 'drun/public/deepseek-r1')).toBe(drun);
    expect(addFactoryKey(withDrun, companyKeyFor('drun'))).toEqual({});
  });
});

describe('a card’s run button', () => {
  const shanesCard: CardFacts = { author: 'ward', owner: 'shane', lastActor: 'ward', origin: 'board' };
  const noFactoryKey: StoryState = { ...BASE_STATE, sharedAccount: null };

  it('runs on the clicker’s own plan when no Factory key exists and own plans are allowed', () => {
    const run = stageRun(noFactoryKey, shanesCard, 'execute');
    expect(run).toMatchObject({ kind: 'mine', plan: PLANS.claudeMax });
    expect(run.kind === 'mine' && billingFor(noFactoryKey, run.card, 'execute')).toMatchObject({ payer: 'shane' });
  });

  it('stays blocked when the Factory runs on company keys only and none is connected', () => {
    const run = stageRun({ ...noFactoryKey, ...COMPANY_KEYS_ONLY }, shanesCard, 'execute');
    expect(run).toMatchObject({ kind: 'blocked', reason: 'shared-account' });
  });

  it('runs a teammate’s card on the plan its session started on', () => {
    const ownerPays: StoryState = { ...BASE_STATE, factoryWorkRunsOn: 'owner' };
    const wardsCard: CardFacts = { author: 'ward', owner: 'ward', lastActor: 'ward', origin: 'board' };
    const run = stageRun(ownerPays, wardsCard, 'execute');
    expect(run.kind === 'ready' && payerOf(ownerPays, run.card, 'execute')).toBe('ward');
  });

  it('moves the run to the Factory account only when the owner’s plan cannot run', () => {
    const disconnected: StoryState = {
      ...BASE_STATE,
      factoryWorkRunsOn: 'owner',
      memberPlans: { ...BASE_STATE.memberPlans, ward: { ...PLANS.claudeMax, disconnected: true } },
    };
    const wardsCard: CardFacts = { author: 'ward', owner: 'ward', lastActor: 'ward', origin: 'board' };
    const run = stageRun(disconnected, wardsCard, 'execute');
    expect(run.kind === 'ready' && payerOf(disconnected, run.card, 'execute')).toBe('factory');
  });
});
