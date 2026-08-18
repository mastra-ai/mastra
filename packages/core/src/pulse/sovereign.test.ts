import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it } from 'vitest';
import { Agent } from '../agent';
import { agentThreadStreamRuntime } from '../agent/thread-stream-runtime';
import { MockMemory } from '../memory/mock';
import { InMemoryPulseStorage } from '../storage/domains/pulse/inmemory';
import { PulseBus } from './bus';
import { registerPulseEmitter, unregisterPulseEmitter } from './emitter';
import { factIds } from './identity';

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

      // ── The readers derive the flow from these facts alone ──
      const store = new InMemoryPulseStorage();
      await store.batchCreatePulses(c.facts);
      const { flows } = await store.listFlows();
      expect(flows).toHaveLength(1);
      expect(flows[0]).toMatchObject({ flowId: runId, runId, status: 'completed', threadId: 'sov-t' });
      expect(flows[0]!.durationMs).not.toBeNull();
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
