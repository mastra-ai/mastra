import { describe, expect, it } from 'vitest';

import { knowledgeRefetchInterval } from '../../../../../hooks/useKnowledgeGraph';
import { RequestError } from '../../services/request';
import { isIdle } from './useInteractionIdle';

describe('isIdle', () => {
  it('is idle only once idleMs has elapsed since the last interaction', () => {
    expect(isIdle(1_000, 10_999, 10_000)).toBe(false);
    expect(isIdle(1_000, 11_000, 10_000)).toBe(true);
  });
});

describe('knowledgeRefetchInterval (poll pauses while the user interacts)', () => {
  it('polls at 5s when idle and healthy', () => {
    expect(knowledgeRefetchInterval(null, false)).toBe(5_000);
  });

  it('pauses while the user is interacting', () => {
    expect(knowledgeRefetchInterval(null, true)).toBe(false);
  });

  it('keeps polling through transient errors when idle', () => {
    expect(knowledgeRefetchInterval(new RequestError('boom', 500), false)).toBe(5_000);
  });

  it('stops permanently on a 404 regardless of interaction', () => {
    expect(knowledgeRefetchInterval(new RequestError('gone', 404), false)).toBe(false);
    expect(knowledgeRefetchInterval(new RequestError('gone', 404), true)).toBe(false);
  });
});
