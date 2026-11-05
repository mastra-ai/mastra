import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { DurableStepIds, AGENT_STREAM_TOPIC, AgentStreamEventTypes } from '../constants';
import {
  DEFAULT_TIMEOUT_MS,
  consumeText,
  createGate,
  createRestartScenario,
  findRow,
  loadGraph,
} from './restart-harness';
import type { Gate } from './restart-harness';

const usage = { inputTokens: 10, outputTokens: 20, totalTokens: 30 };
const streamStart = (id: string) => [
  { type: 'stream-start', warnings: [] },
  { type: 'response-metadata', id, modelId: 'mock-model-id', timestamp: new Date(0) },
];

// Decides from the transcript, so graph 2 makes the call graph 1 would have
// made for the same history: two tool rounds, then text.
function createModel(calls: { count: number }) {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      calls.count++;
      const answered = prompt.filter(m => m.role === 'tool').flatMap(m => m.content).length;
      const parts =
        answered < 2
          ? [
              ...streamStart(`call-${answered}`),
              {
                type: 'tool-call',
                toolCallId: `call-${answered}`,
                toolName: 'lookup',
                input: JSON.stringify({ index: answered }),
              },
              { type: 'finish', finishReason: 'tool-calls', usage },
            ]
          : [
              ...streamStart('text'),
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'done' },
              { type: 'text-end', id: 'text-1' },
              { type: 'finish', finishReason: 'stop', usage },
            ];
      return { stream: convertArrayToReadableStream(parts as any[]), rawCall: { rawPrompt: null, rawSettings: {} } };
    },
  });
}

const gates: Gate[] = [];
const scenarios: { stop(): Promise<void> }[] = [];
afterEach(async () => {
  // Release graph 1's gates first: a parked step must not be stopped mid-flight.
  for (const gate of gates.splice(0)) gate.release();
  await Promise.all(scenarios.splice(0).map(s => s.stop()));
});

// Graph 1 blocks the second tool call (step 2) on the gate; graph 2 runs freely.
function toolScenario(kind: 'durable' | 'evented' | 'evented-fallback', runId: string) {
  const gate = createGate();
  gates.push(gate);
  const toolCalls: { generation: number; index: number }[] = [];
  const modelCalls = new Map<number, { count: number }>();
  const scenario = createRestartScenario({
    kind,
    runId,
    build: ({ core, generation }) => {
      const calls = { count: 0 };
      modelCalls.set(generation, calls);
      return new core.Agent({
        id: 'restart-agent',
        name: 'restart-agent',
        instructions: 'Use your tools.',
        model: createModel(calls),
        tools: {
          lookup: core.createTool({
            id: 'lookup',
            description: 'Looks something up',
            inputSchema: z.object({ index: z.number() }),
            execute: async ({ index }) => {
              toolCalls.push({ generation, index });
              if (generation === 1 && index === 1) await gate.wait();
              return { ok: true, index };
            },
          }),
        },
      });
    },
  });
  scenarios.push(scenario);
  return { scenario, gate, toolCalls, modelCalls };
}

describe('restart harness', () => {
  for (const kind of ['durable', 'evented'] as const) {
    it(`${kind}: recovers a run blocked in a tool at step 2 in a fresh graph`, async () => {
      const runId = `restart-${kind}-gate`;
      const { scenario, gate, toolCalls } = toolScenario(kind, runId);
      const original = await scenario.start(({ agent }) => agent.stream('Look two things up', { runId }));
      await gate.reached;

      const checkpoint = await original.checkpoint();
      expect(findRow(checkpoint, DurableStepIds.AGENTIC_LOOP, runId)?.snapshot.status).toBe('running');

      const recovered = await scenario.restart(checkpoint);
      expect(recovered.streamErrors).toEqual([]);
      expect(recovered.executionError).toBeUndefined();
      expect(recovered.text).toBe('done');
      expect(recovered.finishEvents).toBe(1);
      expect(recovered.onFinishCalls).toBe(1);
      // Graph 2 re-ran the blocked call; it never re-ran the finished first one.
      expect(toolCalls.filter(c => c.generation === 2).map(c => c.index)).toEqual([1]);
    }, 30_000);
  }

  it('evented-fallback: runs on the default engine and recovers from the gate', async () => {
    const runId = 'restart-evented-fallback-gate';
    const { scenario, gate } = toolScenario('evented-fallback', runId);
    const original = await scenario.start(({ agent }) => agent.stream('Look two things up', { runId }));
    await gate.reached;
    const recovered = await scenario.restart(await original.checkpoint());
    expect(recovered.text).toBe('done');
    expect(recovered.finishEvents).toBe(1);
  }, 30_000);

  // The recovery is only real if graph 1 cannot reach graph 2 — otherwise a
  // restart test could pass because the original run finished instead.
  for (const kind of ['durable', 'evented'] as const) {
    it(`${kind}: cuts graph 1 off — releasing the original run after restart changes nothing in graph 2`, async () => {
      const runId = `restart-isolation-${kind}`;
      const { scenario, gate, toolCalls, modelCalls } = toolScenario(kind, runId);
      const original = await scenario.start(({ agent }) => agent.stream('Look two things up', { runId }));
      await gate.reached;
      const recovered = await scenario.restart(await original.checkpoint());
      expect(recovered.text).toBe('done');

      const graph2 = recovered.graph;
      const before = await graph2.workflows.listWorkflowRuns();
      const graph2ModelCalls = modelCalls.get(2)!.count;

      // Let graph 1 finish its own run to the end, publishing its own FINISH.
      gate.release();
      const originalText = await consumeText((await original.driven) as any);
      expect(originalText).toBe('done');
      expect(toolCalls.filter(c => c.generation === 1).map(c => c.index)).toEqual([0, 1]);
      // Graph 1 finished and cleaned up in its own store...
      await vi.waitFor(
        async () =>
          expect(
            await original.graph.workflows.loadWorkflowSnapshot({ workflowName: DurableStepIds.AGENTIC_LOOP, runId }),
          ).toBeFalsy(),
        { timeout: DEFAULT_TIMEOUT_MS },
      );

      // ...and nothing it did reached graph 2. `finishEvents`/`onFinishCalls`
      // read live, so a FINISH leaking in from graph 1 after this point shows up.
      expect(await graph2.workflows.listWorkflowRuns()).toEqual(before);
      expect(modelCalls.get(2)!.count).toBe(graph2ModelCalls);
      expect(toolCalls.filter(c => c.generation === 2).map(c => c.index)).toEqual([1]);
      expect(recovered.finishEvents).toBe(1);
      expect(recovered.onFinishCalls).toBe(1);
    }, 30_000);
  }

  // The other half of isolation: graph 2 must not read graph 1's live store,
  // but it must still see everything graph 1 had persisted. Without this, a
  // restart test that asserts on memory, scores or traces would be measuring an
  // empty store and still pass.
  it('gives graph 2 everything graph 1 persisted, not only the workflow rows', async () => {
    const runId = 'restart-seeding';
    const { scenario, gate } = toolScenario('durable', runId);
    const original = await scenario.start(({ agent }) => agent.stream('Look two things up', { runId }));
    await gate.reached;

    const checkpoint = await original.checkpoint();
    // Written to a non-workflow domain, and only after the checkpoint was taken,
    // so it is nowhere in the rows the restart replays.
    const thread = {
      id: 'restart-seeding-thread',
      resourceId: 'restart-seeding-resource',
      title: 'before the restart',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await original.graph.storage.stores.memory.saveThread({ thread });
    await original.graph.storage.stores.memory.saveMessages({
      messages: [
        {
          id: 'restart-seeding-message',
          threadId: thread.id,
          resourceId: thread.resourceId,
          role: 'user',
          createdAt: new Date(),
          content: { format: 2, parts: [{ type: 'text', text: 'written in graph 1' }] },
        },
      ],
    });

    const recovered = await scenario.restart(checkpoint);
    expect(recovered.text).toBe('done');

    const graph2Memory = recovered.graph.storage.stores.memory;
    expect(await graph2Memory.getThreadById({ threadId: thread.id })).toMatchObject({
      id: thread.id,
      title: 'before the restart',
    });
    expect(
      (await graph2Memory.listMessages({ threadId: thread.id })).messages.map((m: { id: string }) => m.id),
    ).toEqual(['restart-seeding-message']);

    // Seeded, not shared: graph 2 writes into its own store.
    await graph2Memory.saveThread({ thread: { ...thread, id: 'restart-seeding-thread-2' } });
    expect(
      await original.graph.storage.stores.memory.getThreadById({ threadId: 'restart-seeding-thread-2' }),
    ).toBeFalsy();
  }, 30_000);

  // Positive control for the isolation assertions above: `finishEvents` really
  // does read live. Graph 2 already counted its one FINISH; a FINISH published
  // onto its topic *after* `restart()` returned must still bump the count, which
  // the old snapshot-at-return fields could not observe.
  it('counts a FINISH published after restart returned (live counters)', async () => {
    const runId = 'restart-live-counter';
    const { scenario, gate } = toolScenario('durable', runId);
    const original = await scenario.start(({ agent }) => agent.stream('Look two things up', { runId }));
    await gate.reached;
    const recovered = await scenario.restart(await original.checkpoint());
    expect(recovered.finishEvents).toBe(1);

    await recovered.graph.mastra.pubsub.publish(AGENT_STREAM_TOPIC(runId), { type: AgentStreamEventTypes.FINISH });
    expect(recovered.finishEvents).toBe(2);
  }, 30_000);

  it('workflow: restarts a default-engine run blocked in step 2, and from every running write', async () => {
    const runId = 'restart-workflow';
    const gate = createGate();
    gates.push(gate);
    const executed: { generation: number; step: string }[] = [];
    const scenario = createRestartScenario({
      kind: 'workflow',
      runId,
      build: ({ core, generation }) => {
        const step = (id: string, gated = false) =>
          core.createStep({
            id,
            inputSchema: z.object({ trail: z.array(z.string()) }),
            outputSchema: z.object({ trail: z.array(z.string()) }),
            execute: async ({ inputData }) => {
              executed.push({ generation, step: id });
              if (gated && generation === 1) await gate.wait();
              return { trail: [...inputData.trail, id] };
            },
          });
        return core
          .createWorkflow({
            id: 'restart-wf',
            inputSchema: z.object({ trail: z.array(z.string()) }),
            outputSchema: z.object({ trail: z.array(z.string()) }),
          })
          .then(step('a'))
          .then(step('b', true))
          .then(step('c'))
          .commit();
      },
    });
    scenarios.push(scenario);
    const original = await scenario.start(async ({ workflow }) => {
      const run = await workflow.createRun({ runId });
      return run.start({ inputData: { trail: [] } });
    });
    await gate.reached;

    const recovered = await scenario.restart(await original.checkpoint());
    expect(recovered.result.status).toBe('success');
    expect(recovered.result.result).toEqual({ trail: ['a', 'b', 'c'] });
    expect(executed.filter(e => e.generation === 2).map(e => e.step)).toEqual(['b', 'c']);

    // Every-write mode: restart from each copy that has a running row.
    gate.release();
    expect(((await original.driven) as any).status).toBe('success');
    const running = original.checkpoints.filter(c => findRow(c, 'restart-wf', runId)?.snapshot.status === 'running');
    expect(running.length).toBeGreaterThan(1);
    for (const checkpoint of running) {
      const result = await scenario.restart(checkpoint);
      expect(result.result.status, `write ${checkpoint.write}`).toBe('success');
      expect(result.result.result, `write ${checkpoint.write}`).toEqual({ trail: ['a', 'b', 'c'] });
    }
  }, 60_000);

  it('workflow: cuts graph 1 inside a write, parked before the next step starts', async () => {
    const runId = 'restart-workflow-hold';
    const executed: { generation: number; step: string }[] = [];
    const scenario = createRestartScenario({
      kind: 'workflow',
      runId,
      // The cut point: `a` was committed, `b` has not started. No gate is used —
      // the write that saved `a` does not return until the hold is released, so
      // the engine cannot advance past it.
      hold: { when: snapshot => snapshot.context?.a?.status === 'success' && snapshot.context?.b === undefined },
      build: ({ core, generation }) => {
        const step = (id: string) =>
          core.createStep({
            id,
            inputSchema: z.object({ trail: z.array(z.string()) }),
            outputSchema: z.object({ trail: z.array(z.string()) }),
            execute: async ({ inputData }: any) => {
              executed.push({ generation, step: id });
              return { trail: [...inputData.trail, id] };
            },
          });
        return core
          .createWorkflow({
            id: 'restart-wf-hold',
            inputSchema: z.object({ trail: z.array(z.string()) }),
            outputSchema: z.object({ trail: z.array(z.string()) }),
          })
          .then(step('a'))
          .then(step('b'))
          .then(step('c'))
          .commit();
      },
    });
    scenarios.push(scenario);
    const original = await scenario.start(async ({ workflow }) => {
      const run = await workflow.createRun({ runId });
      return run.start({ inputData: { trail: [] } });
    });
    await original.held;

    // Parked: `a` is persisted and `b` never started, so the cut is deterministic
    // without polling or timers.
    expect(executed.filter(e => e.generation === 1).map(e => e.step)).toEqual(['a']);
    const checkpoint = await original.checkpoint();
    expect(findRow(checkpoint, 'restart-wf-hold', runId)?.snapshot.context?.a?.status).toBe('success');
    expect(findRow(checkpoint, 'restart-wf-hold', runId)?.snapshot.context?.b).toBeUndefined();

    const recovered = await scenario.restart(checkpoint);
    expect(recovered.result.status).toBe('success');
    expect(recovered.result.result).toEqual({ trail: ['a', 'b', 'c'] });
    // Graph 2 re-ran only what had not been committed; graph 1 never got past `a`.
    expect(executed.filter(e => e.generation === 2).map(e => e.step)).toEqual(['b', 'c']);
    expect(executed.filter(e => e.generation === 1).map(e => e.step)).toEqual(['a']);
  }, 30_000);

  it('loads a fresh module graph each time', async () => {
    const first = await loadGraph();
    first.globalRunRegistry.set('graph-1-run', {} as any);
    const second = await loadGraph();

    expect(second.Mastra).not.toBe(first.Mastra);
    expect(second.Agent).not.toBe(first.Agent);
    expect(second.globalRunRegistry).not.toBe(first.globalRunRegistry);
    expect(first.globalRunRegistry.get('graph-1-run')).toBeDefined();
    expect(second.globalRunRegistry.get('graph-1-run')).toBeUndefined();
    first.globalRunRegistry.delete('graph-1-run');
  });

  it('fails loudly when the checkpoint has no running snapshot to recover', async () => {
    const runId = 'restart-negative';
    const { scenario, gate } = toolScenario('durable', runId);
    gate.release();
    const original = await scenario.start(({ agent }) => agent.stream('Look two things up', { runId }));
    expect(await consumeText((await original.driven) as any)).toBe('done');

    // A finished run deleted its snapshots, so there is nothing to recover.
    await vi.waitFor(
      async () =>
        expect(
          await original.graph.workflows.loadWorkflowSnapshot({ workflowName: DurableStepIds.AGENTIC_LOOP, runId }),
        ).toBeFalsy(),
      { timeout: DEFAULT_TIMEOUT_MS },
    );
    const finished = await original.checkpoint();
    expect(findRow(finished, DurableStepIds.AGENTIC_LOOP, runId)).toBeUndefined();
    // A checkpoint whose root row exists but is no longer running is rejected too.
    // (An agent's loop row is deleted on finish rather than rewritten, so build one.)
    const running = original.checkpoints.filter(
      c => findRow(c, DurableStepIds.AGENTIC_LOOP, runId)?.snapshot.status === 'running',
    );
    expect(running.length).toBeGreaterThan(0);
    const stale = structuredClone(running.at(-1)!);
    findRow(stale, DurableStepIds.AGENTIC_LOOP, runId)!.snapshot.status = 'success';
    await expect(scenario.restart(stale)).rejects.toThrow(/no running .* row for run restart-negative \(found success/);
    await expect(scenario.restart(finished)).rejects.toThrow(/no running .* row for run restart-negative/);
    await expect(scenario.restart({ rows: [], write: 0 })).rejects.toThrow(/found none; rows: none/);
  }, 30_000);
});
