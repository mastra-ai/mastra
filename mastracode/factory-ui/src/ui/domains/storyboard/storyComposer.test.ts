import { describe, expect, it } from 'vitest';

import { STORIES, storyState } from './stories';
import {
  borrowedPlanOwner,
  composerBilling,
  composerFooter,
  composerLocked,
  composerTopTray,
  lockedLaneModel,
  modelChangeGuarded,
  takeOwnershipEffects,
} from './storyComposer';
import { BASE_STATE, EACH_OWNER_PAYS, takeOwnership } from './storyState';
import type { CardFacts, LaneModel, StoryState } from './storyState';

function stateAt(storyId: string, stepIndex: number): StoryState {
  const story = STORIES.find(candidate => candidate.id === storyId);
  if (!story) throw new Error(`No story ${storyId}`);
  return storyState(story, stepIndex);
}

function focusAt(storyId: string, stepIndex: number) {
  const state = stateAt(storyId, stepIndex);
  const card = state.cards[0];
  if (!card) throw new Error('Story step has no cards');
  return { state, card };
}

describe('composer on someone else’s session', () => {
  it('sends straight away and names whose session and plan it steers', () => {
    const { state, card } = focusAt('teammates-plan', 1);
    expect(composerLocked(state, card)).toBe(false);
    expect(composerFooter(state, card)).toEqual({ kind: 'steer', owner: 'ward', payer: 'ward' });
  });

  it('teaches steering once, until the viewer dismisses it', () => {
    const { state, card } = focusAt('teammates-plan', 0);
    expect(composerTopTray(state, card)).toEqual({ kind: 'steer-hint', owner: 'ward' });
    expect(composerTopTray({ ...state, steerHintSeen: true }, card)).toBeNull();
  });

  it('offers only the owner’s plan models while steering their personal plan', () => {
    const { state, card } = focusAt('teammates-plan', 1);
    expect(borrowedPlanOwner(state, composerBilling(state, card))).toBe('ward');
    const factoryPaid = { ...state, factoryWorkRunsOn: 'shared' } satisfies StoryState;
    expect(borrowedPlanOwner(factoryPaid, composerBilling(factoryPaid, card))).toBeNull();
  });

  it('locks the model while the agent runs', () => {
    const { card } = focusAt('teammates-plan', 1);
    expect(modelChangeGuarded(card)).toBe(true);
    expect(modelChangeGuarded(focusAt('teammates-plan', 2).card)).toBe(false);
  });

  it('moves billing to the new owner only on an explicit take ownership, and says the cache restarts', () => {
    const { state, card } = focusAt('teammates-plan', 1);
    expect(composerBilling(state, takeOwnership(state, card))).toMatchObject({ payer: 'shane' });
    expect(takeOwnershipEffects(state, card)).toEqual([
      'Billing moves to your Claude Max.',
      'Your models: Opus 5.5.',
      'The prompt cache restarts: the next turn re-reads the whole thread.',
    ]);
    expect(composerFooter(focusAt('teammates-plan', 2).state, focusAt('teammates-plan', 2).card)).toBeNull();
  });
});

describe('composer tray under the input', () => {
  it('says so when sending takes a Factory card over', () => {
    const stuck = focusAt('auto-run-stuck', 1);
    expect(composerFooter(stuck.state, stuck.card)).toEqual({ kind: 'takeover', from: 'factory' });
    const taken = focusAt('auto-run-stuck', 2);
    expect(composerFooter(taken.state, taken.card)).toBeNull();
  });
});

describe('composer after the onboarding payer choice', () => {
  const ownerPays: StoryState = { ...stateAt('onboarding-cloudflare', 1), ...EACH_OWNER_PAYS };
  const ownCard = { author: 'shane', owner: 'shane', lastActor: 'shane', origin: 'board' } satisfies CardFacts;
  const wardsCard = { ...ownCard, owner: 'ward', lastActor: 'ward' } satisfies CardFacts;

  it('runs on the viewer’s own plan when the company-keys-only admin switches to “Each owner pays”', () => {
    expect(composerBilling(ownerPays, ownCard)).toMatchObject({ kind: 'ready', payer: 'shane' });
    expect(composerLocked(ownerPays, wardsCard)).toBe(false);
  });
});

describe('composer in a lane that asks for its model', () => {
  const lane: LaneModel = { model: 'GPT-5', thinking: 'high', locked: true };
  const locked: StoryState = { ...BASE_STATE, laneModels: { review: lane } };
  const card = {
    author: 'grayson',
    owner: 'ward',
    lastActor: 'ward',
    origin: 'board',
    lane: 'review',
  } satisfies CardFacts;

  it('names the lane model only when the lane locks it', () => {
    expect(lockedLaneModel(locked, card)).toBe('GPT-5');
    expect(lockedLaneModel(locked, { ...card, lane: 'triage' })).toBeNull();
    expect(lockedLaneModel({ ...locked, laneModels: { review: { ...lane, locked: false } } }, card)).toBeNull();
  });
});
