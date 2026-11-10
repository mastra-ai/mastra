import { createOpenAI } from '@ai-sdk/openai-v5';
import type { ChatCompletionRequest } from '@copilotkit/aimock';
import { describe, expect, it } from 'vitest';
import { InMemoryServerCache } from '../../../cache/inmemory';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { createSharedAgent, useLoopScenarioAimock } from '../../../loop/test-utils/aimock/aimock-scenario';
import { SCENARIO_MODEL_ID } from '../../../loop/test-utils/aimock/types';
import { Agent } from '../../agent';
import { createDurableAgent, createEventedAgent } from '../../durable';

/**
 * COR-1519 cell 3: a streaming plain supervisor delegating to a plain, durable
 * or evented sub-agent publishes each run on its own `agent.stream.<runId>`
 * topic, exactly once, and neither run's frames land in the other's stream.
 *
 * Everything runs through the public API (`agent.stream()`, `agent.observe()`)
 * on a real Mastra with a shared in-process pubsub; only the model is AIMock.
 */

const SUPERVISOR_TEXT = 'Supervisor says: order 42 has shipped.';
const WORKER_TEXT = 'Worker says: order 42 shipped yesterday.';

const toolNames = (req: ChatCompletionRequest) => (req.tools ?? []).map(t => t.function?.name);
const isSupervisor = (req: ChatCompletionRequest) => toolNames(req).includes('agent-worker');
const lastIsToolResult = (req: ChatCompletionRequest) => req.messages.at(-1)?.role === 'tool';

type Published = { topic: string; type: string; runId?: string; chunkType?: string; text?: string };

function recordingPubSub() {
  const pubsub = new EventEmitterPubSub();
  const published: Published[] = [];
  const original = pubsub.publish.bind(pubsub);
  pubsub.publish = async (topic: string, event: any) => {
    if (topic.startsWith('agent.stream.')) {
      published.push({
        topic,
        type: event?.type,
        runId: event?.runId,
        chunkType: event?.data?.type,
        text: event?.data?.type === 'text-delta' ? event.data.payload?.text : undefined,
      });
    }
    return original(topic, event);
  };
  return { pubsub, published };
}

async function collect(stream: ReadableStream<any> | AsyncIterable<any>) {
  const chunks: any[] = [];
  for await (const chunk of stream as AsyncIterable<any>) chunks.push(chunk);
  return chunks;
}

const textOf = (chunks: any[]) =>
  chunks
    .filter(c => c.type === 'text-delta')
    .map(c => c.payload.text)
    .join('');

describe.each(['plain', 'durable', 'evented'] as const)(
  'COR-1519: streaming supervisor delegating to a %s sub-agent',
  kind => {
    const getMock = useLoopScenarioAimock();

    it('publishes each run once on its own topic and never mixes their frames', async () => {
      const llm = getMock();
      llm.on(
        { endpoint: 'chat', predicate: req => isSupervisor(req) && !lastIsToolResult(req) },
        { toolCalls: [{ id: 'call-worker-1', name: 'agent-worker', arguments: { prompt: 'Where is order 42?' } }] },
      );
      llm.on({ endpoint: 'chat', predicate: req => !isSupervisor(req) }, { content: WORKER_TEXT });
      llm.on(
        { endpoint: 'chat', predicate: req => isSupervisor(req) && lastIsToolResult(req) },
        { content: SUPERVISOR_TEXT },
      );

      const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });
      const inner = new Agent({
        id: 'worker',
        name: 'worker',
        description: 'Looks up orders',
        instructions: 'You look up orders.',
        model: openai(SCENARIO_MODEL_ID),
      });
      const worker =
        kind === 'plain'
          ? inner
          : kind === 'durable'
            ? createDurableAgent({ agent: inner })
            : createEventedAgent({ agent: inner });

      const { pubsub, published } = recordingPubSub();
      const shared = await createSharedAgent(llm, {
        agents: { worker: worker as unknown as Agent },
        pubsub,
        cache: new InMemoryServerCache(),
      });
      shared.mastra.addAgent(worker, 'worker');
      const supervisor: Agent = shared.agent;

      const output = await supervisor.stream('Where is order 42?');
      const parentRunId = output.runId;
      const callerChunks = await collect(output.fullStream);

      expect(textOf(callerChunks)).toBe(SUPERVISOR_TEXT);

      const topics = [...new Set(published.map(p => p.topic))];
      const parentTopic = `agent.stream.${parentRunId}`;
      expect(topics).toContain(parentTopic);
      const childTopics = topics.filter(t => t !== parentTopic);
      // eslint-disable-next-line no-console
      console.info(
        `[COR-1519 supervisor ${kind}] parent=${parentRunId} topics=${JSON.stringify(
          topics.map(t => ({
            t: t === parentTopic ? 'parent' : t,
            n: published.filter(p => p.topic === t).length,
            finish: published.filter(p => p.topic === t && p.type === 'finish').length,
            text: published
              .filter(p => p.topic === t)
              .map(p => p.text ?? '')
              .join(''),
          })),
        )}`,
      );

      // Every event on a topic carries that topic's runId.
      for (const p of published) {
        if (p.runId !== undefined) expect(`agent.stream.${p.runId}`).toBe(p.topic);
      }

      // The parent run finishes once and carries only the supervisor's own text deltas.
      const parentEvents = published.filter(p => p.topic === parentTopic);
      expect(parentEvents.filter(p => p.type === 'finish')).toHaveLength(1);
      expect(parentEvents.map(p => p.text ?? '').join('')).toBe(SUPERVISOR_TEXT);

      // The sub-agent is its own run: one distinct topic, one finish, the worker text exactly once.
      expect(childTopics).toHaveLength(1);
      const childEvents = published.filter(p => p.topic === childTopics[0]);
      expect(childEvents.filter(p => p.type === 'finish')).toHaveLength(1);
      expect(childEvents.map(p => p.text ?? '').join('')).toBe(WORKER_TEXT);

      // Replays through the public API match: the parent replay has the supervisor
      // text once, and the child replay has the worker text once.
      const parentReplay = await supervisor.observe(parentRunId);
      const parentReplayChunks = await collect(parentReplay.fullStream);
      expect(textOf(parentReplayChunks)).toBe(SUPERVISOR_TEXT);
      expect(parentReplayChunks.filter(c => c.type === 'finish')).toHaveLength(1);
      expect(parentReplayChunks.map(c => c.type)).toEqual(callerChunks.map(c => c.type));

      const childRunId = childTopics[0]!.slice('agent.stream.'.length);
      expect(childRunId).not.toBe(parentRunId);
      const childReplay = await (worker as any).observe(childRunId);
      const childReplayChunks = await collect(childReplay.fullStream ?? childReplay.output?.fullStream);
      expect(textOf(childReplayChunks)).toBe(WORKER_TEXT);
      expect(childReplayChunks.filter(c => c.type === 'finish')).toHaveLength(1);
    });
  },
);
