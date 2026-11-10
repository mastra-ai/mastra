import { createOpenAI } from '@ai-sdk/openai-v5';
import type { ChatCompletionRequest } from '@copilotkit/aimock';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { InMemoryServerCache } from '../../../cache/inmemory';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { createSharedAgent, useLoopScenarioAimock } from '../../../loop/test-utils/aimock/aimock-scenario';
import { SCENARIO_MODEL_ID } from '../../../loop/test-utils/aimock/types';
import { MockMemory } from '../../../memory/mock';
import { createTool } from '../../../tools';
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

/**
 * Resumed delegation: the worker suspends on a tool approval, the supervisor run
 * suspends with it, and `approveToolCall()` resumes both. The resume path passes
 * the suspended worker runId back to the worker, so its continuation must stay on
 * the worker's own topic and the supervisor continuation on the supervisor's.
 */
describe.each(['plain', 'durable', 'evented'] as const)(
  'COR-1519: streaming supervisor resuming a suspended %s sub-agent',
  kind => {
    const getMock = useLoopScenarioAimock();

    it('keeps the worker and supervisor continuations on their own runs after approval', async () => {
      const llm = getMock();
      const toolRuns: string[] = [];
      const lookupOrder = createTool({
        id: 'lookup-order',
        description: 'Look up an order',
        inputSchema: z.object({ orderId: z.string() }),
        requireApproval: true,
        execute: async ({ orderId }) => {
          toolRuns.push(orderId);
          return { orderId, status: 'shipped' };
        },
      });
      llm.on(
        { endpoint: 'chat', predicate: req => isSupervisor(req) && !lastIsToolResult(req) },
        { toolCalls: [{ id: 'call-worker-1', name: 'agent-worker', arguments: { prompt: 'Where is order 42?' } }] },
      );
      llm.on(
        { endpoint: 'chat', predicate: req => !isSupervisor(req) && !lastIsToolResult(req) },
        { toolCalls: [{ id: 'call-lookup-1', name: 'lookup-order', arguments: { orderId: '42' } }] },
      );
      llm.on(
        { endpoint: 'chat', predicate: req => !isSupervisor(req) && lastIsToolResult(req) },
        { content: WORKER_TEXT },
      );
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
        tools: { 'lookup-order': lookupOrder },
      });
      const worker =
        kind === 'plain'
          ? inner
          : kind === 'durable'
            ? createDurableAgent({ agent: inner })
            : createEventedAgent({ agent: inner });

      const { pubsub, published } = recordingPubSub();
      const memory = new MockMemory();
      const shared = await createSharedAgent(llm, {
        agents: { worker: worker as unknown as Agent },
        pubsub,
        cache: new InMemoryServerCache(),
        memory,
      });
      shared.mastra.addAgent(worker, 'worker');
      const supervisor: Agent = shared.agent;
      const thread = `cor-1519-resume-${kind}`;
      const resource = 'cor-1519-resume-user';

      const first = await supervisor.stream('Where is order 42?', { memory: { thread, resource }, maxSteps: 3 });
      const parentRunId = first.runId;
      const firstChunks = await collect(first.fullStream);
      expect(firstChunks.map(c => c.type)).toContain('tool-call-approval');
      expect(toolRuns).toEqual([]);
      const publishedBeforeResume = published.length;

      const entry = await vi.waitFor(async () => {
        const { messages } = await memory.recall({ threadId: thread, resourceId: resource });
        const pending = [...messages].reverse().find((m: any) => m.content?.metadata?.pendingToolApprovals) as any;
        expect(pending).toBeDefined();
        return Object.values(pending.content.metadata.pendingToolApprovals)[0] as { runId: string; toolCallId: string };
      });

      const resumed = (await supervisor.approveToolCall({
        runId: entry.runId,
        toolCallId: entry.toolCallId,
        memory: { thread, resource },
      } as any)) as unknown as { runId?: string; fullStream: AsyncIterable<any> };
      const resumedChunks = await collect(resumed.fullStream);
      expect(resumedChunks.map(c => c.type)).not.toContain('error');
      expect(toolRuns).toEqual(['42']);
      expect(textOf(resumedChunks)).toBe(SUPERVISOR_TEXT);

      const topics = [...new Set(published.map(p => p.topic))];
      const parentTopic = `agent.stream.${parentRunId}`;
      const summary = topics.map(t => ({
        t: t === parentTopic ? 'parent' : t,
        before: published.slice(0, publishedBeforeResume).filter(p => p.topic === t).length,
        after: published.slice(publishedBeforeResume).filter(p => p.topic === t).length,
        types: [...new Set(published.filter(p => p.topic === t).map(p => p.type))],
        finish: published.filter(p => p.topic === t && p.type === 'finish').length,
        text: published
          .filter(p => p.topic === t)
          .map(p => p.text ?? '')
          .join(''),
      }));
      // eslint-disable-next-line no-console
      console.info(
        `[COR-1519 resumed supervisor ${kind}] parent=${parentRunId} approvalRunId=${entry.runId} resumedRunId=${resumed.runId} topics=${JSON.stringify(summary)}`,
      );

      for (const p of published) {
        if (p.runId !== undefined) expect(`agent.stream.${p.runId}`).toBe(p.topic);
      }

      // The resume continues the same two runs: no new topic, both segments of each
      // run on its own topic, one suspension and one finish each, texts unmixed.
      expect(resumed.runId).toBe(parentRunId);
      expect(topics).toHaveLength(2);
      const childTopic = topics.find(t => t !== parentTopic)!;
      for (const { topic, text } of [
        { topic: parentTopic, text: SUPERVISOR_TEXT },
        { topic: childTopic, text: WORKER_TEXT },
      ]) {
        const before = published.slice(0, publishedBeforeResume).filter(p => p.topic === topic);
        const after = published.slice(publishedBeforeResume).filter(p => p.topic === topic);
        expect(before.length, topic).toBeGreaterThan(0);
        expect(after.length, topic).toBeGreaterThan(0);
        expect(
          before.filter(p => p.type === 'suspended'),
          topic,
        ).toHaveLength(1);
        expect(
          [...before, ...after].filter(p => p.type === 'finish'),
          topic,
        ).toHaveLength(1);
        expect(after.map(p => p.text ?? '').join(''), topic).toBe(text);
      }

      const parentReplay = await collect((await supervisor.observe(parentRunId)).fullStream);
      expect(textOf(parentReplay)).toBe(SUPERVISOR_TEXT);
      expect(parentReplay.filter(c => c.type === 'finish')).toHaveLength(1);

      const childReplay = await (worker as any).observe(childTopic.slice('agent.stream.'.length));
      const childReplayChunks = await collect(childReplay.fullStream ?? childReplay.output?.fullStream);
      expect(textOf(childReplayChunks)).toBe(WORKER_TEXT);
      expect(childReplayChunks.filter(c => c.type === 'finish')).toHaveLength(1);
    });
  },
);
