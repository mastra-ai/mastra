/**
 * Regression for #29035.
 *
 * Delegated sub-agent chunks are forwarded on the durable run stream wrapped in
 * `tool-output` payloads. The nested agent `step-start` / `step-finish` /
 * `finish` chunks carry the sub-agent's full request, input messages,
 * cumulative steps and message history. Published verbatim, every forwarded
 * chunk repeated those snapshots in the run stream and its 24h replay cache.
 */
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryServerCache } from '../../../cache/inmemory';
import { CachingPubSub } from '../../../events/caching-pubsub';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { Event } from '../../../events/types';
import { Agent } from '../../agent';
import { AGENT_STREAM_TOPIC } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import { emitChunkEvent } from '../stream-adapter';

const BIG = 'x'.repeat(100_000);

/** Snapshot fields present on any agent chunk nested under a `tool-output` / `workflow-step-output` wrapper. */
function nestedSnapshotFields(chunk: any, path = '$'): string[] {
  const found: string[] = [];
  if (!chunk || typeof chunk !== 'object') return found;
  const inner = chunk.payload?.output;
  if ((chunk.type === 'tool-output' || chunk.type === 'workflow-step-output') && inner && typeof inner === 'object') {
    const innerPath = `${path}.payload.output`;
    const p = inner.payload ?? {};
    if (inner.from === 'AGENT') {
      if ('request' in p) found.push(`${innerPath}.payload.request`);
      if ('inputMessages' in p) found.push(`${innerPath}.payload.inputMessages`);
      if ('messages' in p) found.push(`${innerPath}.payload.messages`);
      if (p.output && typeof p.output === 'object' && 'steps' in p.output)
        found.push(`${innerPath}.payload.output.steps`);
      if (p.metadata && typeof p.metadata === 'object' && 'request' in p.metadata)
        found.push(`${innerPath}.payload.metadata.request`);
    }
    found.push(...nestedSnapshotFields(inner, innerPath));
  }
  return found;
}

describe('durable run stream strips snapshots from delegated chunks (#29035)', () => {
  let inner: EventEmitterPubSub;
  let pubsub: CachingPubSub;

  beforeEach(() => {
    inner = new EventEmitterPubSub();
    pubsub = new CachingPubSub(inner, new InMemoryServerCache());
  });

  async function publishAndRead(runId: string, chunk: any): Promise<any> {
    const received: Event[] = [];
    await pubsub.subscribe(AGENT_STREAM_TOPIC(runId), event => {
      received.push(event);
    });
    await emitChunkEvent(pubsub, runId, chunk);
    const history = await pubsub.getHistory(AGENT_STREAM_TOPIC(runId));
    expect(history).toHaveLength(1);
    expect(received).toHaveLength(1);
    // Live subscribers and the replay cache get the same slimmed chunk.
    expect(received[0]!.data).toEqual(history[0]!.data);
    return history[0]!.data;
  }

  it('removes nested agent finish/step-finish snapshots but keeps usage and tool identity', async () => {
    const chunk = {
      type: 'tool-output',
      runId: 'r1',
      from: 'USER',
      payload: {
        toolCallId: 'call-1',
        toolName: 'agent-sub',
        output: {
          type: 'finish',
          from: 'AGENT',
          runId: 'sub',
          payload: {
            messages: { all: [BIG] },
            output: { steps: [BIG], usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 } },
            metadata: { request: { body: BIG }, modelId: 'mock' },
            stepResult: { reason: 'stop' },
          },
        },
      },
    };

    const data = await publishAndRead('r1', chunk);

    expect(nestedSnapshotFields(data)).toEqual([]);
    expect(data.payload.toolCallId).toBe('call-1');
    expect(data.payload.toolName).toBe('agent-sub');
    expect(data.payload.output.payload.output.usage).toEqual({ inputTokens: 5, outputTokens: 10, totalTokens: 15 });
    expect(data.payload.output.payload.metadata.modelId).toBe('mock');
    expect(JSON.stringify(data).length).toBeLessThan(5_000);
  });

  it('removes nested agent step-start request and input messages, including through workflow wrappers', async () => {
    const chunk = {
      type: 'workflow-step-output',
      from: 'WORKFLOW',
      payload: {
        output: {
          type: 'tool-output',
          from: 'USER',
          payload: {
            toolCallId: 'call-2',
            output: {
              type: 'step-start',
              from: 'AGENT',
              payload: { messageId: 'm1', request: { body: BIG }, inputMessages: [BIG] },
            },
          },
        },
      },
    };

    const data = await publishAndRead('r2', chunk);

    expect(nestedSnapshotFields(data)).toEqual([]);
    expect(data.payload.output.payload.output.payload.messageId).toBe('m1');
    expect(JSON.stringify(data).length).toBeLessThan(5_000);
  });

  it('publishes top-level chunks unchanged', async () => {
    const chunk = {
      type: 'step-start',
      from: 'AGENT',
      runId: 'r3',
      payload: { messageId: 'm1', request: { body: 'keep' } },
    };

    const data = await publishAndRead('r3', chunk);

    expect(data).toEqual(chunk);
  });

  it('publishes data a tool writes itself unchanged, even when it looks like an agent chunk', async () => {
    const chunk = {
      type: 'tool-output',
      from: 'USER',
      runId: 'r4',
      payload: {
        toolCallId: 'c1',
        toolName: 'tool',
        output: {
          type: 'finish',
          payload: {
            messages: { all: ['keep'] },
            output: { steps: ['keep'] },
            metadata: { request: { body: 'keep' } },
          },
        },
      },
    };

    const data = await publishAndRead('r4', chunk);

    expect(data).toEqual(chunk);
  });

  it('keeps sub-agent snapshots out of the replay cache for a real delegation', async () => {
    const subAgentModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'sub-0', modelId: 'mock-model', timestamp: new Date(0) },
          { type: 'text-start', id: 'sub-text' },
          { type: 'text-delta', id: 'sub-text', delta: 'Sub result' },
          { type: 'text-end', id: 'sub-text' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        request: { body: BIG },
        warnings: [],
      }),
    }) as LanguageModelV2;

    let supervisorCalls = 0;
    const supervisorModel = new MockLanguageModelV2({
      doStream: async () => {
        supervisorCalls++;
        const parts =
          supervisorCalls === 1
            ? [
                {
                  type: 'tool-call' as const,
                  toolCallType: 'function' as const,
                  toolCallId: 'sup-call-1',
                  toolName: 'agent-sub',
                  input: JSON.stringify({ prompt: 'go' }),
                  providerExecuted: false,
                },
                {
                  type: 'finish' as const,
                  finishReason: 'tool-calls' as const,
                  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                },
              ]
            : [
                { type: 'text-start' as const, id: 'sup-text' },
                { type: 'text-delta' as const, id: 'sup-text', delta: 'Done' },
                { type: 'text-end' as const, id: 'sup-text' },
                {
                  type: 'finish' as const,
                  finishReason: 'stop' as const,
                  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                },
              ];
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            {
              type: 'response-metadata',
              id: `sup-${supervisorCalls}`,
              modelId: 'mock-model',
              timestamp: new Date(0),
            },
            ...parts,
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
    }) as LanguageModelV2;

    const sub = new Agent({
      id: 'sub',
      name: 'sub',
      description: 'Sub-agent',
      instructions: `You are a helpful sub-agent. ${'context '.repeat(5_000)}`,
      model: subAgentModel,
    });
    const supervisor = new Agent({
      id: 'supervisor-snapshots',
      name: 'supervisor-snapshots',
      instructions: 'Delegate to sub.',
      model: supervisorModel,
      agents: { sub },
    });

    const runId = 'delegated-snapshots-run';
    const durableAgent = createDurableAgent({ agent: supervisor, pubsub: inner, cache: new InMemoryServerCache() });
    const output = await durableAgent.stream('Please delegate', { runId, maxSteps: 3 });
    let text = '';
    for await (const chunk of output.fullStream) {
      if (chunk.type === 'text-delta') text += chunk.payload.text;
    }
    expect(text).toBe('Done');

    // Read before cleanup(), which clears the run's cached topic.
    const history = await durableAgent.pubsub.getHistory(AGENT_STREAM_TOPIC(runId));
    output.cleanup();
    const delegated = history.filter(
      event => (event.data as any)?.type === 'tool-output' && (event.data as any)?.payload?.output?.from === 'AGENT',
    );
    const nestedTypes = new Set(delegated.map(event => (event.data as any).payload.output.type));
    expect(nestedTypes).toContain('step-start');
    expect(nestedTypes).toContain('finish');

    const leaked = history.flatMap((event, i) => nestedSnapshotFields(event.data, `history[${i}].data`));
    expect(leaked).toEqual([]);

    // The sub-agent's usage still travels on its nested finish chunk.
    const nestedFinish = delegated.find(event => (event.data as any).payload.output.type === 'finish');
    expect((nestedFinish!.data as any).payload.output.payload.output.usage).toMatchObject({ totalTokens: 15 });
  });
});
