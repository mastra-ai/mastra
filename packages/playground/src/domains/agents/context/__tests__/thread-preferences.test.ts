import { describe, expect, it } from 'vitest';
import { threadPreferencesSchema, serializeThreadPreferences } from '../thread-preferences';

describe('Thread preferences schema', () => {
  describe('when preferences contain explicit clears', () => {
    it('distinguishes cleared fields from absent fields and preserves zero and false', () => {
      const stored = serializeThreadPreferences({
        modelSettings: { temperature: undefined, maxRetries: 0, requireToolApproval: false },
      });
      const preferences = threadPreferencesSchema.parse(JSON.parse(stored));
      expect(preferences).toEqual({
        selection: undefined,
        modelSettings: { temperature: undefined, maxRetries: 0, requireToolApproval: false },
      });
      expect(Object.hasOwn(preferences.modelSettings ?? {}, 'maxSteps')).toBe(false);
    });
  });
  describe('when a thread has an empty preference record', () => {
    it('leaves model settings unset', () => {
      expect(threadPreferencesSchema.parse({}).modelSettings).toBeUndefined();
    });
  });
  describe('when individual stored fields are invalid', () => {
    it('recovers valid fields independently', () => {
      expect(
        threadPreferencesSchema.parse({
          selection: { provider: 42, model: 'invalid' },
          modelSettings: { temperature: 0.2, maxSteps: 'invalid', maxRetries: 0 },
        }),
      ).toEqual({ selection: undefined, modelSettings: { temperature: 0.2, maxRetries: 0 } });
    });
  });
});
