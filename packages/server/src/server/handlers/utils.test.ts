import { describe, it, expect } from 'vitest';
import { sanitizeBody, stripClientCredentialHeaders } from './utils';

describe('utils', () => {
  describe('stripClientCredentialHeaders', () => {
    it('removes credential headers from modelSettings.headers and keeps the rest', () => {
      const body: Record<string, unknown> = {
        modelSettings: {
          temperature: 0.2,
          headers: { Authorization: 'Bearer app-user-token', 'x-api-key': 'leak', 'x-trace-id': 'trace-1' },
        },
      };
      stripClientCredentialHeaders(body);
      expect(body.modelSettings).toEqual({ temperature: 0.2, headers: { 'x-trace-id': 'trace-1' } });
    });

    it('leaves bodies without modelSettings headers untouched', () => {
      const body: Record<string, unknown> = { messages: [], modelSettings: { temperature: 0.2 } };
      stripClientCredentialHeaders(body);
      expect(body).toEqual({ messages: [], modelSettings: { temperature: 0.2 } });
    });
  });

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
