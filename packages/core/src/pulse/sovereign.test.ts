import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Agent } from '../agent';
import { agentThreadStreamRuntime } from '../agent/thread-stream-runtime';
import { MockMemory } from '../memory/mock';
import { InMemoryPulseStorage } from '../storage/domains/pulse/inmemory';
import { createTool } from '../tools';
import { PulseBus } from './bus';
import { registerPulseEmitter, unregisterPulseEmitter } from './emitter';
import { factIds } from './identity';
import { withPulseRun } from './run-context';

/**
 * THE sovereignty property (goal SOVEREIGN, P1): with observability fully
 * OFF, pulse still records the run first-hand — minted deterministic ids,
 * flow id = runId, computed parentage, first-hand usage — and the readers
 * derive a complete flow from those facts alone.
 */

const settle = (ms = 20) => new Promise(r => setTimeout(r, ms));
async function waitFor(pred: () => boolean, timeoutMs = 2_000) {
  const start = Date.now();
  while (!pred()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out');
    await new Promise(r => setTimeout(r, 0));
  }
}

function collector() {
  const bus = new PulseBus();
  const facts: any[] = [];
  const edges: any[] = [];
  bus.subscribe((e: any) => (e.type === 'pulse' ? facts.push(e.record) : edges.push(e.record)));
  registerPulseEmitter(bus);
  return { facts, edges, done: () => unregisterPulseEmitter(bus) };
}

function model() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'sov-1', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'st' },
        { type: 'text-delta', id: 'st', delta: 'sovereign' },
        { type: 'text-end', id: 'st' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: {
            inputTokens: 30,
            outputTokens: 12,
            totalTokens: 42,
            inputDetails: { text: 30, cacheRead: 0, cacheWrite: 0 },
            outputDetails: { text: 12, reasoning: 0 },
          },
        },
      ]),
    }),
  });
}

describe('sovereignty: observability OFF, pulse alone', () => {
  beforeEach(() => {
    agentThreadStreamRuntime.resetForTests();
  });

  it('records the run first-hand with minted ids and derives a complete flow', async () => {
    const c = collector();
    try {
      // No Mastra, no Observability — nothing but the agent and the sink.
      const agent = new Agent({
        id: 'sov-agent',
        name: 'Sovereign Agent',
        instructions: 'Test',
        model: model(),
        memory: new MockMemory(),
      });
      const stream = await agent.stream('Hello', { memory: { thread: 'sov-t', resource: 'sov-u' } });
      const runId = stream.runId!;
      await stream.consumeStream();
      await settle();

      // ── Minted identity: ids are COMPUTED, flow id = runId ──
      const runStart = c.facts.find(f => f.id === factIds.run(runId));
      expect(runStart, 'run started fact at its computed id').toBeDefined();
      expect(runStart).toMatchObject({ surface: 'agent', action: 'run_started', traceId: runId, source: 'native' });

      const runEnd = c.facts.find(f => f.id === factIds.run(runId, 'ended'));
      expect(runEnd).toMatchObject({ action: 'run_completed', type: 'output', traceId: runId });

      const genStart = c.facts.find(f => f.id === factIds.generation(runId));
      expect(genStart).toMatchObject({ surface: 'model', action: 'generate_started', traceId: runId });
      const genEnd = c.facts.find(f => f.id === factIds.generation(runId, 'ended'));
      expect(genEnd).toBeDefined();
      // First-hand usage in fold-key shape — the read-time cost source.
      expect(genEnd.data).toMatchObject({ total_input_tokens: 30, total_output_tokens: 12 });

      const step0 = c.facts.find(f => f.id === factIds.step(runId, 0));
      expect(step0).toMatchObject({ surface: 'model', action: 'step_started', traceId: runId });
      // Step END at the finish-chunk boundary — with the step's own usage.
      const step0End = c.facts.find(f => f.id === factIds.step(runId, 0, 'ended'));
      expect(step0End).toMatchObject({ surface: 'model', action: 'step_completed', traceId: runId });
      expect(step0End.data).toMatchObject({ total_input_tokens: 30, total_output_tokens: 12 });

      // ── Computed parentage: run → generation → step ──
      expect(
        c.edges.some(
          e => e.type === 'parent_of' && e.from.id === factIds.run(runId) && e.to.id === factIds.generation(runId),
        ),
      ).toBe(true);
      expect(
        c.edges.some(
          e => e.type === 'parent_of' && e.from.id === factIds.generation(runId) && e.to.id === factIds.step(runId, 0),
        ),
      ).toBe(true);
      expect(c.edges.some(e => e.type === 'origin_of' && e.to.id === runId)).toBe(true);
      // Definition identity: which agent produced this flow.
      expect(c.edges.some(e => e.type === 'uses_definition' && e.to.id === 'agent:sov-agent')).toBe(true);

      // ── The readers derive the flow from these facts alone ──
      const store = new InMemoryPulseStorage();
      await store.batchCreatePulses(c.facts);
      const { flows } = await store.listFlows();
      expect(flows).toHaveLength(1);
      expect(flows[0]).toMatchObject({ flowId: runId, runId, status: 'completed', threadId: 'sov-t' });
      expect(flows[0]!.durationMs).not.toBeNull();
      // Tree derives from the synthetic node keys — run → generation → step.
      const detail = await store.getFlow(runId);
      expect(detail!.tree.map(n => n.label)).toEqual(
        expect.arrayContaining(['agent.run', 'model.generate', 'model.step']),
      );
    } finally {
      c.done();
    }
  });

  it('content leaving context is a first-hand fact', async () => {
    const c = collector();
    try {
      const { MessageList } = await import('../agent/message-list');
      const list = new MessageList({ threadId: 'ct-t', resourceId: 'ct-u' });
      list.add({ role: 'user', content: 'to be removed' } as any, 'user');
      const [msg] = list.get.all.db();
      list.removeByIds([msg!.id]);
      await settle();
      const removed = c.facts.find(f => f.surface === 'content' && f.action === 'removed');
      expect(removed).toMatchObject({ attributes: { messageId: msg!.id }, threadId: 'ct-t', source: 'native' });
    } finally {
      c.done();
    }
  });

  it('tool calls are first-hand facts with observability OFF', async () => {
    const c = collector();
    try {
      const testTool = createTool({
        id: 'sov-adder',
        description: 'Adds two numbers',
        inputSchema: z.object({ a: z.number(), b: z.number() }),
        execute: async ({ a, b }: any) => ({ sum: a + b }),
      });
      const toolModel = new MockLanguageModelV2({
        doGenerate: async () => ({
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'tool-calls',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          content: [
            {
              type: 'tool-call',
              toolCallType: 'function',
              toolCallId: 'call-1',
              toolName: 'sov-adder',
              input: '{"a":1,"b":2}',
            },
          ],
          warnings: [],
        }),
      });
      const agent = new Agent({
        id: 'sov-tools',
        name: 'Sovereign Tools',
        instructions: 'Test',
        model: toolModel,
        tools: { 'sov-adder': testTool },
      });
      await agent.generate('Add 1 and 2 with the tool');
      await settle();

      const started = c.facts.find(f => f.surface === 'tool' && f.action === 'call_started');
      const ended = c.facts.find(f => f.surface === 'tool' && f.action === 'call_completed');
      expect(started, 'tool call_started fact').toBeDefined();
      expect(ended, 'tool call_completed fact').toBeDefined();
      expect(started.runId, 'tool fact carries the run').toBeTruthy();
      expect(started.traceId).toBe(started.runId); // the run IS the flow
      expect(
        c.edges.some(e => e.type === 'parent_of' && e.to.id === started.id),
        'tool fact is parented',
      ).toBe(true);
    } finally {
      c.done();
    }
  });

  it('processor runs are first-hand facts with observability OFF', async () => {
    const c = collector();
    try {
      const echo: any = {
        id: 'sov-echo',
        name: 'SovEcho',
        processInput: async ({ messages }: any) => messages,
      };
      const agent = new Agent({
        id: 'sov-proc',
        name: 'Sovereign Proc',
        instructions: 'Test',
        model: model(),
        inputProcessors: [echo],
      });
      const stream = await agent.stream('hi');
      await stream.consumeStream();
      await settle();

      const procFacts = c.facts.filter(f => f.surface === 'processor');
      expect(
        procFacts.some(f => f.action === 'run_started'),
        `processor run_started (saw: ${c.facts.map(f => `${f.surface}.${f.action}`).join(',')})`,
      ).toBe(true);
      expect(procFacts.some(f => f.action === 'run_completed' || f.action === 'run_failed')).toBe(true);
      expect(procFacts[0].runId, 'processor fact carries the run').toBeTruthy();
    } finally {
      c.done();
    }
  });

  it('memory operations are first-hand facts with observability OFF', async () => {
    const c = collector();
    try {
      const { MessageHistory } = await import('../processors/memory/message-history');
      const { MessageList } = await import('../agent/message-list');
      const storage: any = { listMessages: async () => ({ messages: [] }) };
      const mh = new MessageHistory({ storage });
      const list = new MessageList({ threadId: 'mh-t', resourceId: 'mh-u' });
      await withPulseRun({ runId: 'mem-run', threadId: 'mh-t' }, () =>
        mh.processInput({
          messages: [],
          messageList: list,
          abort: (() => {
            throw new Error('abort');
          }) as any,
        }),
      );
      await settle();

      const rec = c.facts.find(f => f.surface === 'memory' && f.action === 'operation_started');
      expect(rec, 'memory operation_started fact').toBeDefined();
      expect(rec).toMatchObject({ runId: 'mem-run', traceId: 'mem-run' });
      expect(c.facts.some(f => f.surface === 'memory' && f.action === 'operation_completed')).toBe(true);
    } finally {
      c.done();
    }
  });

  it('minted ids are deterministic across a replay', async () => {
    // Two independent runs of the same logical runId mint identical ids —
    // the readers collapse a replay to one logical record set.
    expect(factIds.run('run-X')).toBe(factIds.run('run-X'));
    expect(factIds.step('run-X', 3)).toBe(factIds.step('run-X', 3));
    expect(factIds.step('run-X', 3)).not.toBe(factIds.step('run-X', 4));
    expect(factIds.run('run-X')).not.toBe(factIds.run('run-Y'));
  });
});
