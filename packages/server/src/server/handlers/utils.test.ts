import { describe, it, expect } from 'vitest';
import { sanitizeBody } from './utils';

describe('utils', () => {
  describe('sanitizeBody', () => {
    it('should remove disallowed keys from the body', () => {
      const body = {
        messages: [],
        system: 'a system prompt',
        tools: {}, // should be removed
      };

      sanitizeBody(body, ['tools']);

      expect(body).toEqual({
        messages: [],
        system: 'a system prompt',
      });
    });

    it('should not modify the body when no disallowed keys are present', () => {
      const body = {
        messages: [],
        system: 'a system prompt',
      };

      const originalBody = { ...body };
      sanitizeBody(body, ['tools']);

      expect(body).toEqual(originalBody);
    });

    it('should handle empty disallowed keys array', () => {
      const body = {
        messages: [],
        system: 'a system prompt',
      };

      const originalBody = { ...body };
      sanitizeBody(body, []);

      expect(body).toEqual(originalBody);
    });

    it('should handle when all keys are disallowed', () => {
      const body = {
        messages: [],
        system: 'a system prompt',
      };

      sanitizeBody(body, ['messages', 'system']);

      expect(body).toEqual({});
    });
  });
});
