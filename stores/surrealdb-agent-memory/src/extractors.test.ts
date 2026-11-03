import type { AgentMemory } from '@surrealdb/memory';
import { describe, expect, it, vi } from 'vitest';
import { agentMemoryExtractedSink } from './extractors';
import type { AgentMemoryExtractedContext } from './extractors';

function makeAgentMemory() {
  const remember = vi.fn().mockResolvedValue({ facts: [] });
  return { agentMemory: { remember } as unknown as AgentMemory, remember };
}

const context = (overrides: Partial<AgentMemoryExtractedContext> = {}): AgentMemoryExtractedContext => ({
  source: 'observer',
  threadId: 'thread-1',
  resourceId: 'user-1',
  extractor: { name: 'User profile', slug: 'user-profile' },
  current: { preferredName: 'Ada' },
  ...overrides,
});

describe('agentMemoryExtractedSink', () => {
  it('persists structured values as literal JSON facts with default labels', async () => {
    const { agentMemory, remember } = makeAgentMemory();
    const sink = agentMemoryExtractedSink(agentMemory);

    await sink(context());

    expect(remember).toHaveBeenCalledWith(JSON.stringify({ preferredName: 'Ada' }), {
      // extraction already happened client-side; store literally
      infer: 'none',
      labels: ['extractor=user-profile', 'threadId=thread-1', 'resourceId=user-1'],
    });
  });

  it('passes string values through unchanged and omits missing resourceId', async () => {
    const { agentMemory, remember } = makeAgentMemory();
    const sink = agentMemoryExtractedSink(agentMemory);

    await sink(context({ current: 'plain text fact', resourceId: undefined }));

    expect(remember).toHaveBeenCalledWith('plain text fact', {
      infer: 'none',
      labels: ['extractor=user-profile', 'threadId=thread-1'],
    });
  });

  it('skips the write when format returns null or the value is nullish', async () => {
    const { agentMemory, remember } = makeAgentMemory();

    await agentMemoryExtractedSink(agentMemory)(context({ current: undefined as unknown as string }));
    await agentMemoryExtractedSink(agentMemory, { format: () => null })(context());

    expect(remember).not.toHaveBeenCalled();
  });

  it('supports custom labels (static and factory) and remember options', async () => {
    const { agentMemory, remember } = makeAgentMemory();

    await agentMemoryExtractedSink(agentMemory, {
      labels: ['source=om'],
      remember: { memoryCategory: 'profile', sessionId: 'sess-1' },
    })(context());
    expect(remember).toHaveBeenLastCalledWith(expect.any(String), {
      infer: 'none',
      memoryCategory: 'profile',
      sessionId: 'sess-1',
      labels: ['source=om'],
    });

    await agentMemoryExtractedSink(agentMemory, {
      labels: ctx => [`slug=${ctx.extractor.slug}`, `src=${ctx.source}`],
    })(context({ source: 'reflector' }));
    expect(remember).toHaveBeenLastCalledWith(expect.any(String), {
      infer: 'none',
      labels: ['slug=user-profile', 'src=reflector'],
    });
  });

  it('allows overriding the infer mode for server-side re-inference', async () => {
    const { agentMemory, remember } = makeAgentMemory();

    await agentMemoryExtractedSink(agentMemory, {
      remember: { infer: 'full' },
    })(context());

    expect(remember).toHaveBeenLastCalledWith(expect.any(String), {
      infer: 'full',
      labels: ['extractor=user-profile', 'threadId=thread-1', 'resourceId=user-1'],
    });
  });

  it('never throws into the observation cycle; routes failures to onError', async () => {
    const remember = vi.fn().mockRejectedValue(new Error('agentMemory down'));
    const agentMemory = { remember } as unknown as AgentMemory;
    const onError = vi.fn();

    await expect(agentMemoryExtractedSink(agentMemory, { onError })(context())).resolves.toBeUndefined();

    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0]?.[0] as Error).message).toBe('agentMemory down');

    // default onError only warns
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(agentMemoryExtractedSink(agentMemory)(context())).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
