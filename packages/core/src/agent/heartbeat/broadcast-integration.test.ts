/**
 * End-to-end check that the per-fire heartbeat broadcast processor — built by
 * `executeHeartbeat` and passed through `sendSignal(..., ifIdle.streamOptions.outputProcessors)`
 * — actually filters chunks on the subscribed thread stream.
 *
 * One scenario per broadcast mode (`live`, `on-complete`, `never`).
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { Agent } from '../agent';
import { executeHeartbeat } from './worker';

function createTextStreamModel(responseText: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: responseText },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        },
      ]),
    }),
  });
}

async function readWholeRun(iterator: AsyncIterator<any>) {
  const parts: any[] = [];
  while (true) {
    const next = await iterator.next();
    if (next.done) return parts;
    parts.push(next.value);
    if (next.value.type === 'finish' || next.value.type === 'error' || next.value.type === 'abort') {
      return parts;
    }
  }
}

function makeAgentAndMastra(responseText: string) {
  const agent = new Agent({
    id: 'hb-broadcast-agent',
    name: 'Heartbeat Broadcast Agent',
    instructions: 'test',
    model: createTextStreamModel(responseText),
    memory: new MockMemory(),
  });
  const mastra = new Mastra({ logger: false, agents: { agent } });
  return { agent, mastra };
}

async function preCreateThread(agent: Agent, threadId: string, resourceId: string) {
  const memory = await agent.getMemory();
  await memory!.createThread({ threadId, resourceId });
}

describe('heartbeat broadcast processor on subscribed thread stream', () => {
  it('live mode passes text-delta chunks through unchanged', async () => {
    const { agent, mastra } = makeAgentAndMastra('hello live');
    const resourceId = 'hb-res-live';
    const threadId = 'hb-thread-live';
    await preCreateThread(agent, threadId, resourceId);

    const subscription = await agent.subscribeToThread({ threadId, resourceId });
    const iterator = subscription.stream[Symbol.asyncIterator]();
    const runPromise = readWholeRun(iterator);

    await executeHeartbeat(mastra, 'hb_live', {
      type: 'heartbeat',
      agentId: agent.id,
      prompt: 'tick',
      threadId,
      resourceId,
      broadcast: 'live',
    });

    const parts = await runPromise;
    const textDeltas = parts.filter(p => p.type === 'text-delta');
    expect(textDeltas.length).toBeGreaterThan(0);
    expect(parts.some(p => p.type === 'finish')).toBe(true);

    subscription.unsubscribe();
  });

  it('on-complete mode drops intermediate chunks and replays full text on finish', async () => {
    const fullText = 'hello on-complete';
    const { agent, mastra } = makeAgentAndMastra(fullText);
    const resourceId = 'hb-res-oc';
    const threadId = 'hb-thread-oc';
    await preCreateThread(agent, threadId, resourceId);

    const subscription = await agent.subscribeToThread({ threadId, resourceId });
    const iterator = subscription.stream[Symbol.asyncIterator]();
    const runPromise = readWholeRun(iterator);

    await executeHeartbeat(mastra, 'hb_oc', {
      type: 'heartbeat',
      agentId: agent.id,
      prompt: 'tick',
      threadId,
      resourceId,
      broadcast: 'on-complete',
    });

    const parts = await runPromise;

    const finishIndex = parts.findIndex(p => p.type === 'finish');
    expect(finishIndex).toBeGreaterThanOrEqual(0);

    const burst = parts.slice(0, finishIndex);
    const textStarts = burst.filter(p => p.type === 'text-start');
    const textDeltas = burst.filter(p => p.type === 'text-delta');
    const textEnds = burst.filter(p => p.type === 'text-end');

    expect(textStarts.length).toBe(1);
    expect(textEnds.length).toBe(1);
    // exactly one delta carrying the full buffered text
    expect(textDeltas.length).toBe(1);
    expect(textDeltas[0]?.payload?.text).toBe(fullText);

    subscription.unsubscribe();
  });

  it('never mode drops every chunk', async () => {
    const { agent, mastra } = makeAgentAndMastra('never broadcast');
    const resourceId = 'hb-res-never';
    const threadId = 'hb-thread-never';
    await preCreateThread(agent, threadId, resourceId);

    const subscription = await agent.subscribeToThread({ threadId, resourceId });
    const iterator = subscription.stream[Symbol.asyncIterator]();

    // run-until-finish would block forever in `never` mode (no finish reaches
    // the consumer); instead drain with a hard timeout.
    const parts: any[] = [];
    const drained = (async () => {
      while (true) {
        const next = await iterator.next();
        if (next.done) return;
        parts.push(next.value);
      }
    })();

    await executeHeartbeat(mastra, 'hb_never', {
      type: 'heartbeat',
      agentId: agent.id,
      prompt: 'tick',
      threadId,
      resourceId,
      broadcast: 'never',
    });

    // small grace period for any chunks to land
    await new Promise(r => setTimeout(r, 100));
    subscription.unsubscribe();
    await drained;

    // never mode suppresses all content chunks so subscribers see no text.
    // Run lifecycle markers (start / step-start / finish) may still surface
    // from the subscription pipeline — we only assert no text was broadcast.
    expect(parts.filter(p => p.type === 'text-delta')).toHaveLength(0);
    expect(parts.filter(p => p.type === 'text-start')).toHaveLength(0);
    expect(parts.filter(p => p.type === 'text-end')).toHaveLength(0);
  });
});
