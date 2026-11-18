/**
 * COR-1503: a graceful shutdown must not make a durable agent run a tool to completion twice. A tool call still
 * running at the drain deadline keeps the run claimed while it finishes, so its result is checkpointed instead of
 * discarded and recovery continues past it. One still running after that keeps the claim until it expires, so
 * recovery can't run it beside this process.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { SHUTDOWN_TOOL_SETTLE_MS } from '../run-registry';
import { buildAgreementGraph, createScriptModel, toolResults, waitFor } from './restart-agreement-support';
import { createGate, loadGraph } from './restart-harness';

const live: any[] = [];
const gates: ReturnType<typeof createGate>[] = [];
afterEach(async () => {
  for (const gate of gates.splice(0)) gate.release();
  for (const gen of live.splice(0)) {
    await Promise.race([gen.mastra.shutdown({ drainTimeout: 0 }), new Promise(resolve => setTimeout(resolve, 2000))]);
  }
});

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe.each(['auto', 'off'] as const)('durable agent shutdown with a tool call in flight (recovery=%s)', mode => {
  async function setup(
    runId: string,
    {
      calls = 1,
      toolCallConcurrency,
      ownGates = [],
    }: { calls?: number; toolCallConcurrency?: number; ownGates?: string[] } = {},
  ) {
    const { InMemoryStore } = await loadGraph();
    const storage = new InMemoryStore();
    const gate = createGate();
    gates.push(gate);
    // Each call waits on the shared gate unless given its own.
    const callGates = new Map<string, ReturnType<typeof createGate>>();
    const gateFor = (toolCallId: string) => {
      const own = createGate();
      gates.push(own);
      callGates.set(toolCallId, own);
      return own;
    };
    const executions: number[] = [];
    const executedCalls: string[] = [];
    const modelCalls: number[] = [];
    let toolStarted = false;

    const build = ({ core, generation, memory }: any) => {
      const sideEffect = core.createTool({
        id: 'sideEffect',
        description: 'Has a side effect that must happen once',
        inputSchema: z.object({}),
        // Ignores its abort signal, like most tools that call an external API.
        execute: async (_input: unknown, context: any) => {
          const toolCallId = context?.agent?.toolCallId;
          toolStarted = true;
          if (generation === 1) await (callGates.get(toolCallId) ?? gate).wait();
          executions.push(generation);
          executedCalls.push(`${generation}:${toolCallId}`);
          return { ok: true };
        },
      });
      const model = createScriptModel(
        prompt =>
          toolResults(prompt).length === 0
            ? { tools: Array.from({ length: calls }, () => ({ name: 'sideEffect' })) }
            : { text: 'done' },
        { onCall: () => modelCalls.push(generation) },
      );
      return new core.Agent({
        id: 'shutdown-tool',
        name: 'shutdown-tool',
        instructions: 'x',
        model,
        tools: { sideEffect },
        memory,
      });
    };
    const start = (generation: number) =>
      buildAgreementGraph({
        storage,
        id: 'shutdown-tool',
        engine: 'durable',
        generation,
        build,
        mastraExtra: () => (mode === 'off' ? { recovery: undefined } : {}),
      });

    const gen1: any = await start(1);
    live.push(gen1);
    for (const id of ownGates) gateFor(id);
    const result = await gen1.runner.stream('go', {
      runId,
      memory: { thread: 't', resource: 'r' },
      maxSteps: 5,
      toolCallConcurrency,
    });
    void (async () => {
      try {
        for await (const _ of result.fullStream) void _;
      } catch {}
    })();
    await waitFor(() => toolStarted);
    return { storage, gate, callGates, executions, executedCalls, modelCalls, gen1, start };
  }

  it('checkpoints a tool that returns after the drain deadline and does not run it again on recovery', async () => {
    const runId = `shutdown-tool-late-${mode}`;
    const { gate, executions, modelCalls, gen1, start } = await setup(runId);

    const drainTimeout = 200;
    const shutdown = gen1.mastra.shutdown({ drainTimeout });
    // Past the drain deadline, within the time shutdown keeps the claim for a running tool.
    setTimeout(() => gate.release(), drainTimeout + SHUTDOWN_TOOL_SETTLE_MS / 2);
    await shutdown;
    expect(executions).toEqual([1]);
    // The run stopped before asking the model again; recovery makes that request with the saved tool result.
    expect(modelCalls).toEqual([1]);

    const gen2: any = await start(2);
    live.push(gen2);
    const recovered = await gen2.runner.recover(runId);
    let text = '';
    for await (const chunk of recovered.fullStream) if (chunk.type === 'text-delta') text += chunk.payload.text;

    expect(text).toBe('done');
    expect(executions).toEqual([1]);
    expect(modelCalls).toEqual([1, 2]);
  }, 30_000);

  it('does not start a queued tool call while shutdown waits for the running one', async () => {
    const runId = `shutdown-tool-queued-${mode}`;
    const { gate, executions, executedCalls, gen1, start } = await setup(runId, { calls: 2, toolCallConcurrency: 1 });

    const drainTimeout = 200;
    const shutdown = gen1.mastra.shutdown({ drainTimeout });
    setTimeout(() => gate.release(), drainTimeout + SHUTDOWN_TOOL_SETTLE_MS / 2);
    await shutdown;
    await sleep(50);
    expect(executedCalls).toEqual(['1:call-1']);
    // Without running checkpoints the run stopped inside the iteration has none to recover from.
    if (mode === 'off') return;

    const gen2: any = await start(2);
    live.push(gen2);
    const recovered = await gen2.runner.recover(runId);
    let text = '';
    for await (const chunk of recovered.fullStream) if (chunk.type === 'text-delta') text += chunk.payload.text;
    expect(text).toBe('done');
    // Recovery runs the call that never started.
    expect(executedCalls.filter(call => call.startsWith('1:'))).toEqual(['1:call-1']);
    expect(executedCalls).toContain('2:call-2');
  }, 30_000);

  it('lets every running call finish when a queued call reaches shutdown before them', async () => {
    const runId = `shutdown-tool-parallel-${mode}`;
    const { gate, callGates, executedCalls, gen1, start } = await setup(runId, {
      calls: 3,
      toolCallConcurrency: 2,
      ownGates: ['call-2'],
    });
    const second = callGates.get('call-2')!;

    const drainTimeout = 200;
    const shutdown = gen1.mastra.shutdown({ drainTimeout });
    // call-1 frees its slot early in the grace, so queued call-3 reaches shutdown while call-2 still runs.
    setTimeout(() => gate.release(), drainTimeout + SHUTDOWN_TOOL_SETTLE_MS / 5);
    setTimeout(() => second.release(), drainTimeout + SHUTDOWN_TOOL_SETTLE_MS / 2);
    await shutdown;
    await sleep(50);
    expect(executedCalls).toEqual(['1:call-1', '1:call-2']);
    if (mode === 'off') return;

    const gen2: any = await start(2);
    live.push(gen2);
    const recovered = await gen2.runner.recover(runId);
    let text = '';
    for await (const chunk of recovered.fullStream) if (chunk.type === 'text-delta') text += chunk.payload.text;
    expect(text).toBe('done');
    expect(executedCalls.filter(call => call.startsWith('1:'))).toEqual(['1:call-1', '1:call-2']);
    expect(executedCalls).toContain('2:call-3');
  }, 30_000);

  it('keeps the run claimed while a tool is still running after shutdown, so recovery cannot run it beside it', async () => {
    const runId = `shutdown-tool-stuck-${mode}`;
    const { storage, gate, executions, gen1 } = await setup(runId);

    await gen1.mastra.shutdown({ drainTimeout: 100 });
    const workflows = await storage.getStore('workflows');
    const ownership = await workflows.getRunOwnership({ runId });
    expect(ownership?.leaseExpiresAt).not.toBeNull();
    expect(ownership?.leaseExpiresAt?.getTime?.() ?? Number(ownership?.leaseExpiresAt)).toBeGreaterThan(Date.now());

    gate.release();
    await sleep(50);
    expect(executions).toEqual([1]);
  }, 30_000);
});
