/**
 * COR-1503: a graceful shutdown must not let recovery run a durable agent's tool call beside the one still running in
 * the shutting-down process. A run whose tool call ignores the abort stays claimed until that call settles; a run whose
 * calls stop on the abort is released right away.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
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
  async function setup(runId: string, { honorsAbort = false }: { honorsAbort?: boolean } = {}) {
    const { InMemoryStore } = await loadGraph();
    const storage = new InMemoryStore();
    const gate = createGate();
    gates.push(gate);
    const events: string[] = [];
    let toolStarted = false;

    const build = ({ core, generation, memory }: any) => {
      const sideEffect = core.createTool({
        id: 'sideEffect',
        description: 'Has a side effect',
        inputSchema: z.object({}),
        execute: async (_input: unknown, context: any) => {
          toolStarted = true;
          events.push(`${generation}:start`);
          if (generation === 1) {
            const aborted = new Promise<void>(resolve =>
              context?.abortSignal?.addEventListener('abort', () => resolve()),
            );
            await (honorsAbort ? Promise.race([gate.wait(), aborted]) : gate.wait());
          }
          events.push(`${generation}:end`);
          return { ok: true };
        },
      });
      return new core.Agent({
        id: 'shutdown-tool',
        name: 'shutdown-tool',
        instructions: 'x',
        model: createScriptModel(prompt =>
          toolResults(prompt).length === 0 ? { tools: [{ name: 'sideEffect' }] } : { text: 'done' },
        ),
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
    const result = await gen1.runner.stream('go', { runId, memory: { thread: 't', resource: 'r' }, maxSteps: 5 });
    void (async () => {
      try {
        for await (const _ of result.fullStream) void _;
      } catch {}
    })();
    await waitFor(() => toolStarted);
    const lease = async () => {
      const workflows = await storage.getStore('workflows');
      const expiresAt = (await workflows!.getRunOwnership({ runId }))?.leaseExpiresAt;
      return expiresAt == null ? null : new Date(expiresAt).getTime();
    };
    return { gate, events, gen1, start, lease };
  }

  it('keeps the run claimed until a tool call that ignores the abort settles, then lets recovery take it', async () => {
    const runId = `shutdown-tool-claim-${mode}`;
    const { gate, events, gen1, start, lease } = await setup(runId);

    await gen1.mastra.shutdown({ drainTimeout: 100 });
    expect(await lease()).toBeGreaterThan(Date.now());

    gate.release();
    await waitFor(async () => (await lease()) === null);
    expect(events).toEqual(['1:start', '1:end']);
    // Without running checkpoints, a run stopped before its first step boundary has none to recover from.
    if (mode === 'off') return;

    const gen2: any = await start(2);
    live.push(gen2);
    const recovered = await gen2.runner.recover(runId);
    let text = '';
    for await (const chunk of recovered.fullStream) if (chunk.type === 'text-delta') text += chunk.payload.text;

    expect(text).toBe('done');
    // The discarded call runs again on recovery, but never beside the one in the shut-down process.
    expect(events).toEqual(['1:start', '1:end', '2:start', '2:end']);
  }, 30_000);

  it('releases the run right away when its tool call stops on the abort', async () => {
    const runId = `shutdown-tool-aborts-${mode}`;
    const { events, gen1, lease } = await setup(runId, { honorsAbort: true });

    await gen1.mastra.shutdown({ drainTimeout: 100 });
    await sleep(50);
    expect(events).toEqual(['1:start', '1:end']);
    expect(await lease()).toBeNull();
  }, 30_000);
});
