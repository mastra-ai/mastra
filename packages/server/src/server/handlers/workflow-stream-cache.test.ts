import { Mastra } from '@mastra/core';
import { InMemoryServerCache } from '@mastra/core/cache';
import { MockStore } from '@mastra/core/storage';
import type { ChunkType } from '@mastra/core/workflows';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { describe, expect, it, beforeEach } from 'vitest';
import { z } from 'zod';
import { STREAM_WORKFLOW_ROUTE } from './workflows';

/**
 * Coverage for #20188: the cached chunk history belongs to the run, not to the
 * client that happens to be watching it. `/observe` replays from this cache, so
 * it has to be complete and duplicate-free however many clients attach or leave.
 */
function makeWorkflow() {
  const step = createStep({
    id: 'test-step',
    inputSchema: z.object({}),
    outputSchema: z.object({ result: z.string() }),
    execute: async () => ({ result: 'success' }),
  });

  return createWorkflow({
    id: 'test-workflow',
    inputSchema: z.object({}),
    outputSchema: z.object({ result: z.string() }),
    steps: [step],
  })
    .then(step)
    .commit();
}

async function streamRun(mastra: Mastra, runId: string): Promise<ReadableStream<ChunkType>> {
  return (await STREAM_WORKFLOW_ROUTE.handler({
    mastra,
    workflowId: 'test-workflow',
    runId,
    inputData: {},
  } as any)) as ReadableStream<ChunkType>;
}

/** Wait for the run's cached history to be complete. */
async function settledCache(cache: InMemoryServerCache, runId: string): Promise<ChunkType[]> {
  for (let i = 0; i < 200; i++) {
    const chunks = (await cache.listFromTo(runId, 0)) as ChunkType[];
    if (chunks.some(chunk => chunk.type === 'workflow-finish')) return chunks;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  return (await cache.listFromTo(runId, 0)) as ChunkType[];
}

describe('workflow stream caching', () => {
  let mastra: Mastra;
  let cache: InMemoryServerCache;

  beforeEach(() => {
    cache = new InMemoryServerCache();
    mastra = new Mastra({
      logger: false,
      workflows: { 'test-workflow': makeWorkflow() },
      storage: new MockStore(),
      cache,
    });
  });

  it('caches the full run after the client disconnects', async () => {
    const runId = 'run-disconnect';
    const stream = await streamRun(mastra, runId);

    // Read one chunk, then walk away — the client is gone before the run ends.
    const reader = stream.getReader();
    await reader.read();
    await reader.cancel();

    const cached = await settledCache(cache, runId);
    expect(cached.map(chunk => chunk.type)).toContain('workflow-finish');
  });

  it('caches each chunk once when a run is streamed concurrently', async () => {
    const runId = 'run-concurrent';

    const [first, second] = await Promise.all([streamRun(mastra, runId), streamRun(mastra, runId)]);
    const drain = async (stream: ReadableStream<ChunkType>) => {
      const seen: ChunkType[] = [];
      for await (const chunk of stream as any) seen.push(chunk);
      return seen;
    };
    const [seenByFirst] = await Promise.all([drain(first), drain(second)]);

    const cached = await settledCache(cache, runId);
    expect(cached.length).toBe(seenByFirst.length);
  });
});
