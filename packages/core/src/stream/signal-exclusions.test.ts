import { describe, expect, it } from 'vitest';
import type { AgentSignalType } from '../agent/signals';
import { isSignalChunkExcluded } from './signal-exclusions';

const types: AgentSignalType[] = ['user', 'state', 'reactive', 'notification', 'user-message', 'system-reminder'];

describe('signal chunk exclusions', () => {
  it.each(types)('matches encoded %s on either signal envelope', type => {
    for (const envelope of ['data-signal', 'data-user-message']) {
      const chunk = { type: envelope, data: { type } };
      expect(isSignalChunkExcluded(chunk, true)).toBe(true);
      expect(isSignalChunkExcluded(chunk, false)).toBe(false);
      expect(isSignalChunkExcluded(chunk, [type])).toBe(true);
      expect(isSignalChunkExcluded(chunk, [])).toBe(false);
      expect(isSignalChunkExcluded(chunk, undefined)).toBe(false);
    }
  });

  it.each([
    ['reactive', 'system-reminder'],
    ['system-reminder', 'reactive'],
    ['user', 'user-message'],
    ['user-message', 'user'],
  ] as const)('normalizes %s and %s', (encoded, excluded) => {
    expect(isSignalChunkExcluded({ type: 'data-signal', data: { type: encoded } }, [excluded])).toBe(true);
  });

  it('uses encoded type rather than the envelope or tag name', () => {
    const chunk = { type: 'data-user-message', data: { type: 'state', tagName: 'system-reminder' } };
    expect(isSignalChunkExcluded(chunk, ['user', 'reactive'])).toBe(false);
    expect(isSignalChunkExcluded(chunk, ['state'])).toBe(true);
  });

  it.each([
    null,
    undefined,
    42,
    'reactive',
    {},
    [],
    { type: 'data-signal' },
    { type: 'data-signal', data: null },
    { type: 'data-signal', data: [] },
    { type: 'data-signal', data: 'reactive' },
    { type: 'data-signal', data: {} },
    { type: 'data-signal', data: { type: 'unknown', tagName: 'system-reminder' } },
    { type: 'data-user-message', data: { type: 1 } },
    ...['text-delta', 'error', 'finish', 'abort', 'suspend', 'data-other'].map(type => ({
      type,
      data: { type: 'reactive' },
    })),
  ])('preserves unknown, malformed and non-signal chunks: %j', chunk => {
    expect(isSignalChunkExcluded(chunk, types)).toBe(false);
    expect(isSignalChunkExcluded(chunk, true)).toBe(false);
    expect(isSignalChunkExcluded(chunk, false)).toBe(false);
  });
});
