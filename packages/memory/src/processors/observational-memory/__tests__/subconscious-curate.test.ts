import { Agent } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import type { MastraEmbeddingModel, MastraVector } from '@mastra/core/vector';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Memory, Subconscious } from '../../../index';
import { createObservationCuratorHandler } from '../subconscious/curate';

const semanticInfrastructure = {
  vector: {} as MastraVector,
  embedder: {} as MastraEmbeddingModel<string>,
};

function fixture() {
  const memory = new Memory({ storage: new InMemoryStore(), ...semanticInfrastructure });
  const subconscious = new Subconscious({ defaultScope: 'resource', maxScope: 'resource' });
  const requestContext = new RequestContext();
  requestContext.set('organizationId', 'acme');
  const context = {
    parentThreadId: 'alpha',
    resourceId: 'user-42',
    observations: 'User confirmed Project Atlas launches on 2026-09-15.',
    requestContext,
  } as any;
  return { memory, subconscious, context };
}

afterEach(() => vi.restoreAllMocks());

describe('Subconscious observation curator', () => {
  it('prompts with the completed observation delta without worklist operations', async () => {
    const { memory, subconscious, context } = fixture();
    const store = (await memory.storage.getStore('knowledge'))!;
    const worklist = vi.spyOn(store, 'knowledgeBySource');
    const getCursor = vi.spyOn(store, 'getCurationCursor');
    const advanceCursor = vi.spyOn(store, 'advanceCurationCursor');
    const generate = vi.spyOn(Agent.prototype, 'generate').mockResolvedValue({ text: 'Done.' } as any);

    await createObservationCuratorHandler(memory, subconscious.resolved, memory, { omModel: 'openai/test' })(context);

    expect(generate).toHaveBeenCalledWith(
      expect.stringContaining(context.observations),
      expect.objectContaining({
        maxSteps: 200,
        memory: { thread: 'subconscious:alpha:curate', resource: 'user-42' },
      }),
    );
    expect(worklist).not.toHaveBeenCalled();
    expect(getCursor).not.toHaveBeenCalled();
    expect(advanceCursor).not.toHaveBeenCalled();
  });

  it('does not call the model for blank observations', async () => {
    const { memory, subconscious, context } = fixture();
    const generate = vi.spyOn(Agent.prototype, 'generate');

    await expect(
      createObservationCuratorHandler(memory, subconscious.resolved, memory, { omModel: 'openai/test' })({
        ...context,
        observations: '   ',
      }),
    ).resolves.toBe('no-op');
    expect(generate).not.toHaveBeenCalled();
  });

  it('rethrows curator failures to the scheduling boundary without touching turn-scoped sinks', async () => {
    const { memory, subconscious, context } = fixture();
    // Post-commit curation runs after the turn closes, so even if a caller leaks these they must
    // never be used: the stream writer would be closed and the abort signal belongs to a dead turn.
    const sendStateSignal = vi.fn();
    const writer = { custom: vi.fn() };
    const generate = vi.spyOn(Agent.prototype, 'generate').mockRejectedValue(new Error('curator failed'));

    await expect(
      createObservationCuratorHandler(memory, subconscious.resolved, memory, { omModel: 'openai/test' })({
        ...context,
        sendStateSignal,
        writer,
        abortSignal: AbortSignal.abort(),
      }),
    ).rejects.toThrow('curator failed');
    expect(writer.custom).not.toHaveBeenCalled();
    expect(sendStateSignal).not.toHaveBeenCalled();
    expect((generate.mock.calls[0] as unknown[])[1]).not.toHaveProperty('abortSignal');
  });
});
