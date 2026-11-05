/**
 * A plain Agent's caller stream (`agent.stream()` / `/stream`) must number every
 * update with the run-log index `observe()` uses, so a client that loses the
 * caller stream can resume with `observe(runId, { offset: lastIndex + 1 })`.
 * Model traffic goes through AIMock; the run is a multi-step tool loop.
 */
import { createOpenAI } from '@ai-sdk/openai-v5';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { InMemoryServerCache } from '../../../cache/inmemory';
import { CachingPubSub } from '../../../events/caching-pubsub';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { useLoopScenarioAimock } from '../../../loop/test-utils/aimock/aimock-scenario';
import { SCENARIO_MODEL_ID } from '../../../loop/test-utils/aimock/types';
import { Mastra } from '../../../mastra';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';

/** Every append waits a little, so the caller reads chunks before the log has them. */
class SlowCache extends InMemoryServerCache {
  async listPushIndexed(
    listKey: string,
    counterKey: string,
    value: Record<string, unknown>,
    ttlMs?: number,
  ): Promise<number> {
    await new Promise(resolve => setTimeout(resolve, 5));
    return super.listPushIndexed(listKey, counterKey, value, ttlMs);
  }
}

type Chunk = { type: string; index?: number; payload?: any };

const collect = async (stream: ReadableStream<any> | AsyncIterable<any>) => {
  const chunks: Chunk[] = [];
  for await (const chunk of stream as AsyncIterable<Chunk>) chunks.push(chunk);
  return chunks;
};

/** What a client renders from a chunk, independent of how it was transported. */
const view = (chunk: Chunk) => {
  const p = chunk.payload ?? {};
  return `${chunk.type}:${p.text ?? p.toolCallId ?? p.stepResult?.reason ?? ''}`;
};

describe('plain Agent caller stream numbering', () => {
  const getMock = useLoopScenarioAimock();

  const makeAgent = () => {
    getMock().on(
      { endpoint: 'chat', hasToolResult: false },
      { toolCalls: [{ id: 'call-1', name: 'lookup', arguments: JSON.stringify({ q: 'x' }) }] },
    );
    getMock().on({ endpoint: 'chat', hasToolResult: true }, { content: 'Looked it up, all done.' });
    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${getMock().url}/v1` });
    const lookup = createTool({
      id: 'lookup',
      description: 'Look something up.',
      inputSchema: z.object({ q: z.string() }),
      execute: async () => ({ ok: true }),
    });
    const agent = new Agent({
      id: 'index-agent',
      name: 'index-agent',
      instructions: 'Use the lookup tool, then answer.',
      model: openai(SCENARIO_MODEL_ID),
      tools: { lookup },
    });
    const pubsub = new CachingPubSub(new EventEmitterPubSub(), new SlowCache());
    new Mastra({ agents: { agent }, pubsub, logger: false });
    return agent;
  };

  /** Runs to completion and returns what the caller saw plus a full observation of the log. */
  const runAndObserve = async (agent: Agent<any, any, any>) => {
    const output = await agent.stream('Look up x.');
    const caller = await collect(output.fullStream);
    const observed = await collect((await agent.observe(output.runId)).fullStream);
    return { runId: output.runId, caller, observed };
  };

  it('numbers every caller update with the index observe() gives the same update', async () => {
    const agent = makeAgent();
    const { caller, observed } = await runAndObserve(agent);

    expect(caller.some(c => c.type === 'tool-result')).toBe(true);
    expect(caller.filter(c => c.type === 'step-start').length).toBeGreaterThanOrEqual(2);
    expect(caller.filter(c => typeof c.index !== 'number').map(c => c.type)).toEqual([]);

    const byIndex = new Map(observed.map(c => [c.index, view(c)]));
    for (const chunk of caller) {
      expect({ index: chunk.index, view: byIndex.get(chunk.index) }).toEqual({ index: chunk.index, view: view(chunk) });
    }
  });

  it('resumes observe() from the last caller index + 1 at every cut point without gaps or duplicates', async () => {
    const agent = makeAgent();
    const { runId, caller } = await runAndObserve(agent);
    const uninterrupted = caller.map(view);

    for (let cut = 1; cut < caller.length; cut++) {
      const received = caller.slice(0, cut);
      const offset = received.at(-1)!.index! + 1;
      const resumed = await collect((await agent.observe(runId, { offset })).fullStream);
      expect({ cut, combined: [...received, ...resumed].map(view) }).toEqual({ cut, combined: uninterrupted });
    }
  });
});
