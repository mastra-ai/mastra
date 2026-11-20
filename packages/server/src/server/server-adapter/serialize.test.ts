import { describe, expect, it } from 'vitest';
import { serializeStreamChunk } from './serialize';

function expectJson(result: ReturnType<typeof serializeStreamChunk>): string {
  expect(result.ok).toBe(true);
  return (result as { ok: true; json: string }).json;
}

describe('serializeStreamChunk', () => {
  it('serializes plain JSON values', () => {
    const result = serializeStreamChunk({ type: 'workflow-finish', payload: { workflowStatus: 'success' } });
    expect(expectJson(result)).toBe(
      JSON.stringify({ type: 'workflow-finish', payload: { workflowStatus: 'success' } }),
    );
  });

  it('serializes BigInt values as strings', () => {
    const chunk = { type: 'workflow-step-result', payload: { output: { count: 42n } } };
    const json = expectJson(serializeStreamChunk(chunk));
    expect(JSON.parse(json)).toEqual({ type: 'workflow-step-result', payload: { output: { count: '42' } } });
  });

  it('serializes circular references as "[Circular]"', () => {
    const payload: Record<string, unknown> = { id: 'step' };
    payload.self = payload;
    const json = expectJson(serializeStreamChunk({ type: 'workflow-step-result', payload }));
    expect(JSON.parse(json)).toEqual({ type: 'workflow-step-result', payload: { id: 'step', self: '[Circular]' } });
  });

  it('returns the error when the chunk cannot be serialized at all', () => {
    const chunk = {
      type: 'workflow-step-result',
      toJSON() {
        throw new Error('boom from toJSON');
      },
    };
    const result = serializeStreamChunk(chunk);
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: Error }).error.message).toBe('boom from toJSON');
  });

  describe('when a chunk carries an Error in its payload', () => {
    class NotFoundError extends Error {
      constructor(ref: string) {
        super(`Knowledge page "${ref}" not found.`);
        this.name = 'NotFoundError';
      }
    }

    it('keeps the error message, which JSON would drop', () => {
      const chunk = {
        type: 'tool-error',
        payload: { toolCallId: 'c1', toolName: 'knowledge_read', error: new NotFoundError('site:mastra#pricing') },
      };
      const json = expectJson(serializeStreamChunk(chunk));
      expect(JSON.parse(json).payload.error).toEqual({
        name: 'NotFoundError',
        message: 'Knowledge page "site:mastra#pricing" not found.',
      });
    });

    it('keeps the message of an error rebuilt by the agent loop, whose name is an own field', () => {
      // deserializeToolError assigns `name`, so the old wire shape was `{ "name": "Error" }`.
      const error = new Error('Knowledge page "site:mastra#pricing-tiers" not found.');
      error.name = 'Error';
      const json = expectJson(serializeStreamChunk({ type: 'tool-error', payload: { toolCallId: 'c1', error } }));
      expect(JSON.parse(json).payload.error).toEqual({
        name: 'Error',
        message: 'Knowledge page "site:mastra#pricing-tiers" not found.',
      });
    });

    it('sends no stack and leaves the original chunk untouched', () => {
      const error = new Error('boom');
      const chunk = { type: 'error', payload: { error } };
      const json = expectJson(serializeStreamChunk(chunk));
      expect(JSON.parse(json).payload.error).toEqual({ message: 'boom' });
      expect(chunk.payload.error).toBe(error);
    });

    it('sends no stack for an error that already arrives as a plain object, such as a replayed one', () => {
      const json = expectJson(
        serializeStreamChunk({
          type: 'error',
          payload: {
            error: { id: 'TEST_ERROR', name: 'ProviderError', message: 'Provider unavailable', stack: 'at x' },
          },
        }),
      );
      expect(JSON.parse(json).payload.error).toEqual({
        id: 'TEST_ERROR',
        name: 'ProviderError',
        message: 'Provider unavailable',
      });
    });

    describe('when the error class curates its own JSON', () => {
      class ProviderError extends Error {
        requestBodyValues = { apiKey: 'sk-live-secret' };
        constructor() {
          super('provider said no');
          this.name = 'ProviderError';
        }
        toJSON() {
          return { name: this.name, message: this.message };
        }
      }

      it('sends only what its toJSON sends, plus the message', () => {
        const json = expectJson(serializeStreamChunk({ type: 'error', payload: { error: new ProviderError() } }));
        expect(JSON.parse(json).payload.error).toEqual({ name: 'ProviderError', message: 'provider said no' });
        expect(json).not.toContain('sk-live-secret');
      });

      it('keeps the codes and cause a MastraError-style toJSON sends, without a stack', () => {
        class CodedError extends Error {
          toJSON() {
            return { message: this.message, code: 'KNOWLEDGE_PAGE_NOT_FOUND', cause: { id: 'INNER' }, stack: 'at x' };
          }
        }
        const json = expectJson(serializeStreamChunk({ type: 'error', payload: { error: new CodedError('inner') } }));
        expect(JSON.parse(json).payload.error).toEqual({
          message: 'inner',
          code: 'KNOWLEDGE_PAGE_NOT_FOUND',
          cause: { id: 'INNER' },
        });
      });
    });
  });
});
