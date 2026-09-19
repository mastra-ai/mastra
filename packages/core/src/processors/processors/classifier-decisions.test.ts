import { describe, expect, it, vi } from 'vitest';

import type { ClassifierResult } from '../../classifier';
import { decisions } from './classifier-decisions';

const questions = {
  unsafe: { type: 'boolean' },
  route: { type: 'choice', criteria: { support: 'Support', sales: 'Sales', other: 'Other' } },
  quality: { type: 'score', criteria: ['Bad', 'Ok', 'Good'] },
} as const;

type Q = typeof questions;

function ctx(answers: ClassifierResult<Q>['answers']) {
  return {
    phase: 'input' as const,
    result: { answers, usage: { totalTokens: 0 }, warnings: [], response: { timestamp: new Date(), modelId: 'm' } },
  };
}

const answers: ClassifierResult<Q>['answers'] = {
  unsafe: { type: 'boolean', probability: 0.7 },
  route: { type: 'choice', choice: 'sales' },
  quality: { type: 'score', score: 1.2 },
};

describe('decisions.blockIf', () => {
  it('blocks a boolean at or above the probability', async () => {
    const decide = decisions.blockIf<Q, 'unsafe'>('unsafe', { probability: 0.7, reason: 'unsafe' });
    expect(await decide(answers, ctx(answers))).toEqual({ action: 'block', reason: 'unsafe' });
  });

  it('passes a boolean below the probability', async () => {
    const decide = decisions.blockIf<Q, 'unsafe'>('unsafe', { probability: 0.71, reason: 'unsafe' });
    expect(await decide(answers, ctx(answers))).toEqual({ action: 'pass' });
  });

  it('blocks a choice in oneOf', async () => {
    const decide = decisions.blockIf<Q, 'route'>('route', { oneOf: ['sales', 'other'], reason: 'off-topic' });
    expect(await decide(answers, ctx(answers))).toEqual({ action: 'block', reason: 'off-topic' });
  });

  it('blocks a score below scoreBelow or above scoreAbove', async () => {
    const low = decisions.blockIf<Q, 'quality'>('quality', { scoreBelow: 1.5, reason: 'low' });
    const high = decisions.blockIf<Q, 'quality'>('quality', { scoreAbove: 1.0, reason: 'high' });
    const ok = decisions.blockIf<Q, 'quality'>('quality', { scoreBelow: 1.0, scoreAbove: 1.5, reason: 'x' });
    expect(await low(answers, ctx(answers))).toEqual({ action: 'block', reason: 'low' });
    expect(await high(answers, ctx(answers))).toEqual({ action: 'block', reason: 'high' });
    expect(await ok(answers, ctx(answers))).toEqual({ action: 'pass' });
  });

  it('filters instead of blocking when action is filter', async () => {
    const decide = decisions.blockIf<Q, 'unsafe'>('unsafe', { probability: 0.5, reason: 'r', action: 'filter' });
    expect(await decide(answers, ctx(answers))).toEqual({ action: 'filter' });
  });
});

describe('decisions.blockUnless', () => {
  it('passes a choice in oneOf and blocks otherwise', async () => {
    const allowed = decisions.blockUnless<Q, 'route'>('route', { oneOf: ['sales'], reason: 'off-topic' });
    const denied = decisions.blockUnless<Q, 'route'>('route', { oneOf: ['support'], reason: 'off-topic' });
    expect(await allowed(answers, ctx(answers))).toEqual({ action: 'pass' });
    expect(await denied(answers, ctx(answers))).toEqual({ action: 'block', reason: 'off-topic' });
  });

  it('blocks a boolean below the probability', async () => {
    const decide = decisions.blockUnless<Q, 'unsafe'>('unsafe', { probability: 0.9, reason: 'not confident' });
    expect(await decide(answers, ctx(answers))).toEqual({ action: 'block', reason: 'not confident' });
  });

  it('blocks a score outside [scoreAtLeast, scoreAtMost]', async () => {
    const inRange = decisions.blockUnless<Q, 'quality'>('quality', { scoreAtLeast: 1, scoreAtMost: 1.5, reason: 'r' });
    const tooLow = decisions.blockUnless<Q, 'quality'>('quality', { scoreAtLeast: 1.5, reason: 'low' });
    const tooHigh = decisions.blockUnless<Q, 'quality'>('quality', { scoreAtMost: 1, reason: 'high', action: 'filter' });
    expect(await inRange(answers, ctx(answers))).toEqual({ action: 'pass' });
    expect(await tooLow(answers, ctx(answers))).toEqual({ action: 'block', reason: 'low' });
    expect(await tooHigh(answers, ctx(answers))).toEqual({ action: 'filter' });
  });
});

describe('decisions.all', () => {
  it('returns the first non-pass decision and stops evaluating', async () => {
    const third = vi.fn(async () => ({ action: 'block' as const, reason: 'third' }));
    const decide = decisions.all<Q>(
      () => ({ action: 'pass' }),
      async () => ({ action: 'filter' }),
      third,
    );
    expect(await decide(answers, ctx(answers))).toEqual({ action: 'filter' });
    expect(third).not.toHaveBeenCalled();
  });

  it('passes when every decide passes', async () => {
    const decide = decisions.all<Q>(
      decisions.blockIf<Q, 'unsafe'>('unsafe', { probability: 0.99, reason: 'a' }),
      decisions.blockUnless<Q, 'route'>('route', { oneOf: ['sales'], reason: 'b' }),
    );
    expect(await decide(answers, ctx(answers))).toEqual({ action: 'pass' });
  });

  it('passes with no decides', async () => {
    expect(await decisions.all<Q>()(answers, ctx(answers))).toEqual({ action: 'pass' });
  });
});
