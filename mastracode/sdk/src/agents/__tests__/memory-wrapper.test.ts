import { RequestContext } from '@mastra/core/request-context';
import type { Memory } from '@mastra/memory';
import { describe, expect, it, vi } from 'vitest';

import { wrapMemoryForEphemeralInvocations } from '../memory';

/**
 * The wrapper strips the observational-memory processor when no
 * `MastraMemory.thread.id` is present on the RequestContext. This lets
 * `code-agent` be invoked from workflow agent steps (which lack chat-thread
 * context) without tripping.
 *
 * When a thread ID IS present, the wrapper delegates to the underlying
 * getters unchanged.
 */

function makeFakeMemory(processors: Array<{ id: string }>): Memory {
  const getInput = vi.fn(async (_configured: unknown, _ctx: unknown) => [...processors]);
  const getOutput = vi.fn(async (_configured: unknown, _ctx: unknown) => [...processors]);

  return {
    getInputProcessors: getInput,
    getOutputProcessors: getOutput,
  } as unknown as Memory;
}

describe('wrapMemoryForEphemeralInvocations', () => {
  it('strips observational-memory when no MastraMemory.thread.id is on the request context', async () => {
    const memory = makeFakeMemory([
      { id: 'observational-memory' },
      { id: 'working-memory-state' },
      { id: 'other-processor' },
    ]);

    const wrapped = wrapMemoryForEphemeralInvocations(memory);
    const ctx = new RequestContext();

    const inputProcs = await wrapped.getInputProcessors([], ctx);
    expect(inputProcs.map(p => (p as { id: string }).id)).toEqual(['working-memory-state', 'other-processor']);

    const outputProcs = await wrapped.getOutputProcessors([], ctx);
    expect(outputProcs.map(p => (p as { id: string }).id)).toEqual(['working-memory-state', 'other-processor']);
  });

  it('strips observational-memory when MastraMemory is set but thread.id is missing', async () => {
    const memory = makeFakeMemory([{ id: 'observational-memory' }, { id: 'other' }]);
    const wrapped = wrapMemoryForEphemeralInvocations(memory);

    const ctx = new RequestContext();
    ctx.set('MastraMemory', { thread: {}, resourceId: 'r-1' });

    const inputProcs = await wrapped.getInputProcessors([], ctx);
    expect(inputProcs.map(p => (p as { id: string }).id)).toEqual(['other']);
  });

  it('delegates unchanged when MastraMemory.thread.id is present', async () => {
    const memory = makeFakeMemory([{ id: 'observational-memory' }, { id: 'other' }]);
    const wrapped = wrapMemoryForEphemeralInvocations(memory);

    const ctx = new RequestContext();
    ctx.set('MastraMemory', { thread: { id: 'thread-123' }, resourceId: 'r-1' });

    const inputProcs = await wrapped.getInputProcessors([], ctx);
    expect(inputProcs.map(p => (p as { id: string }).id)).toEqual(['observational-memory', 'other']);

    const outputProcs = await wrapped.getOutputProcessors([], ctx);
    expect(outputProcs.map(p => (p as { id: string }).id)).toEqual(['observational-memory', 'other']);
  });

  it('handles missing RequestContext gracefully (treats as ephemeral)', async () => {
    const memory = makeFakeMemory([{ id: 'observational-memory' }, { id: 'other' }]);
    const wrapped = wrapMemoryForEphemeralInvocations(memory);

    const inputProcs = await wrapped.getInputProcessors([], undefined);
    expect(inputProcs.map(p => (p as { id: string }).id)).toEqual(['other']);
  });
});
