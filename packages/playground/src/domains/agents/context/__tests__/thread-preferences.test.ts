import { afterEach, describe, expect, it } from 'vitest';
import { readThreadPreferences, serializeThreadPreferences } from '../thread-preferences';

afterEach(() => localStorage.clear());

describe('Thread preferences storage', () => {
  describe('when preferences contain explicit clears', () => {
    it('distinguishes cleared fields from absent fields and preserves zero and false', () => {
      localStorage.setItem(
        'thread',
        serializeThreadPreferences({
          modelSettings: { temperature: undefined, maxRetries: 0, requireToolApproval: false },
        }),
      );
      expect(readThreadPreferences('thread')).toEqual({
        selection: undefined,
        modelSettings: { temperature: undefined, maxRetries: 0, requireToolApproval: false },
      });
      expect(Object.hasOwn(readThreadPreferences('thread').modelSettings ?? {}, 'maxSteps')).toBe(false);
    });
  });
  describe('when a new thread does not request migration', () => {
    it('does not inherit legacy settings', () => {
      localStorage.setItem('legacy', JSON.stringify({ modelSettings: { temperature: 0.2 } }));
      expect(readThreadPreferences('new-thread')).toEqual({});
    });
  });
  describe('when a thread already has an empty preference record', () => {
    it('does not reapply legacy settings after a reset', () => {
      localStorage.setItem('legacy', JSON.stringify({ modelSettings: { temperature: 0.2 } }));
      localStorage.setItem('thread', '{}');
      expect(readThreadPreferences('thread', 'legacy').modelSettings).toBeUndefined();
    });
  });
});
