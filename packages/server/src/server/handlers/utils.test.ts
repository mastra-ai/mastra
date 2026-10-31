import { RequestContext } from '@mastra/core/request-context';
import { describe, it, expect } from 'vitest';
import { MASTRA_SCOPES_KEY } from '../constants';
import { applyEffectiveThreadId, mergeBodyRequestContext, sanitizeBody, stripClientCredentialHeaders } from './utils';

describe('utils', () => {
  describe('mergeBodyRequestContext', () => {
    it('never lets a body set mastra__scopes', () => {
      const empty = new RequestContext();
      mergeBodyRequestContext(empty, { [MASTRA_SCOPES_KEY]: ['org:victim'], tenant: 'acme' });
      expect(empty.has(MASTRA_SCOPES_KEY)).toBe(false);
      expect(empty.get('tenant')).toBe('acme');

      const middleware = new RequestContext([[MASTRA_SCOPES_KEY, ['org:acme']]]);
      mergeBodyRequestContext(middleware, { [MASTRA_SCOPES_KEY]: ['org:victim'] });
      expect(middleware.get(MASTRA_SCOPES_KEY)).toEqual(['org:acme']);
    });
  });

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

  describe('applyEffectiveThreadId', () => {
    it('returns the effective id for a string thread', () => {
      expect(applyEffectiveThreadId('client-thread', 'ctx-thread')).toBe('ctx-thread');
    });

    it('keeps object fields and applies the effective id', () => {
      expect(applyEffectiveThreadId({ id: 't1', title: 'T', metadata: { tenant_id: 42 } }, 't1')).toEqual({
        id: 't1',
        title: 'T',
        metadata: { tenant_id: 42 },
      });
    });

    it('lets a context thread id override the object id', () => {
      expect(applyEffectiveThreadId({ id: 't1', metadata: { a: 1 } }, 'ctx-thread')).toEqual({
        id: 'ctx-thread',
        metadata: { a: 1 },
      });
    });

    it('drops a client-supplied resourceId from an object thread', () => {
      expect(applyEffectiveThreadId({ id: 't1', resourceId: 'other' } as { id: string }, 't1')).toEqual({ id: 't1' });
    });

    it('returns the thread unchanged when there is no effective id', () => {
      expect(applyEffectiveThreadId(undefined, undefined)).toBeUndefined();
      expect(applyEffectiveThreadId('t1', undefined)).toBe('t1');
    });

    it('returns the effective id when no thread was provided', () => {
      expect(applyEffectiveThreadId(undefined, 'ctx-thread')).toBe('ctx-thread');
    });
  });
});

describe('mergeBodyRequestContext knowledge resource override', () => {
  it('drops a body-supplied reserved Knowledge resource override', async () => {
    const { mergeBodyRequestContext } = await import('./utils');
    const { RequestContext } = await import('@mastra/core/request-context');
    const serverRequestContext = new RequestContext();
    mergeBodyRequestContext(serverRequestContext, { mastra__knowledgeResourceId: 'victim-project' });
    expect(serverRequestContext.get('mastra__knowledgeResourceId')).toBeUndefined();
  });
});
