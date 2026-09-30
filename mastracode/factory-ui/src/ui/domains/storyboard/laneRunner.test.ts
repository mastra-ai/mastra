import { describe, expect, it } from 'vitest';

import { resolveLaneRunner } from './laneRunner';
import type { StoryState } from './storyState';
import { BASE_STATE, laneAutoOn, laneModelFor } from './storyState';

const securityReviewer: StoryState = {
  ...BASE_STATE,
  laneRunners: { review: { kind: 'agent', agentId: 'security-reviewer' } },
};

describe('lane settings cascade', () => {
  it('runs a custom agent on its own model', () => {
    expect(laneModelFor(securityReviewer, 'review')).toEqual({ model: 'Opus 5.5', thinking: 'high' });
  });

  it('falls back to the default agent and the owner’s model on an owner’s-plan lane', () => {
    const ownerLane: StoryState = { ...securityReviewer, laneFunding: { review: 'owner' } };
    expect(resolveLaneRunner(ownerLane, 'review').kind).toBe('skill');
    expect(laneModelFor(ownerLane, 'review')).toBeUndefined();
  });

  it('inherits the board default until the lane sets its own model', () => {
    const boardDefault: StoryState = {
      ...BASE_STATE,
      boardModels: { work: { model: 'Haiku 4.5', thinking: 'low' }, review: { model: 'GPT-5', thinking: 'high' } },
    };
    expect(laneModelFor(boardDefault, 'triage')?.model).toBe('Haiku 4.5');
    expect(laneModelFor(boardDefault, 'review', 'review')?.model).toBe('GPT-5');
    const own = {
      ...boardDefault,
      laneModels: { triage: { model: 'Opus 5.5', thinking: 'xhigh' } },
    } satisfies StoryState;
    expect(laneModelFor(own, 'triage')?.model).toBe('Opus 5.5');
  });

  it('never starts an owner’s-plan lane on its own, whatever the lane asks', () => {
    const state: StoryState = { ...BASE_STATE, laneAuto: { triage: true }, laneFunding: { triage: 'owner' } };
    expect(laneAutoOn(state, 'triage')).toBe(false);
    expect(laneAutoOn({ ...state, laneFunding: {} }, 'triage')).toBe(true);
  });
});
