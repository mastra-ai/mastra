import { describe, expect, it } from 'vitest';
import { serializeStreamChunk } from './serialize';

function expectJson(result: ReturnType<typeof serializeStreamChunk>): string {
  expect(result.ok).toBe(true);
  return (result as { ok: true; json: string }).json;
}

describe('serializeStreamChunk', () => {
  it('serializes plain JSON values', () => {
    const result = serializeStreamChunk({ type: 'workflow-finish', payload: { workflowStatus: 'success' } });
    expect(expectJson(result)).toBe(JSON.stringify({ type: 'workflow-finish', payload: { workflowStatus: 'success' } }));
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
});
