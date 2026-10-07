/**
 * Ported from validation harness case T30 (until-idle-cap).
 *
 * Companion to T19: the script dispatches a new deferred background task on
 * every wake-up, so the run only ends when the script itself stops asking
 * (after CAP dispatches) and answers with text. No wake-up cap is documented on
 * either build, so the case records how many segments the product allowed:
 * `unbounded` (maxSteps 20) shows whether anything stops the loop before the
 * script's own cap, and `max-steps` (maxSteps 3) shows whether maxSteps bounds
 * wake-up segments. The harness runs plain and durable only; evented is
 * excluded because its background workers are covered by T4e.
 *
 * The harness green even when chunk payloads diverge, so this port asserts every
 * harness `evaluate()` check per engine and reproduces the harness's
 * `done(contract)` cross-engine deep-equality on top of it.
 *
 * Expressibility: this case cannot drive `expectEngineParity`. The frozen helper
 * builds its host as `new Mastra({ agents, storage, logger: false })` and never
 * calls `startWorkers()`, and a deferred background dispatch silently degrades to
 * a foreground call without a `BackgroundTaskManager` bound to the host
 * (`Mastra#ensureBackgroundTaskManager` requires `backgroundTasks.enabled` plus
 * storage, and `#maybeEnableBackgroundTasksForAgent` only auto-enables it for
 * agents that declare sub-agents). Running this scenario through the helper would
 * therefore pass every check vacuously without ever exercising the wake-up path.
 * The case instead runs each engine on a case-local host that enables background
 * tasks and starts workers, following the T16/T17 precedent.
 *
 * Timing note: the harness's artificial 1500 ms tool delay is reduced to 400 ms.
 * T30 excludes exact timing from its claims and no check depends on the duration.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

/** The harness excludes evented (`background workers; T4e`). */
const ENGINES = ['plain', 'durable'] as const;
type Engine = (typeof ENGINES)[number];

const VARIANTS = ['unbounded', 'max-steps'] as const;
type Variant = (typeof VARIANTS)[number];

const CAP = 6;
const IDLE_MS = 20_000;
/** The harness's `FETCH_DELAY_MS` is 1500; 400 keeps the port CI-viable. */
const FETCH_DELAY_MS = 400;
const USAGE = { inputTokens: 1, outputTokens: 1, totalTokens: 2 } as const;

type ToolLogEntry = { tool: string; event: string; name: string };

/** The harness's `createFetchRecordTool` without the probe/block/adopt instrumentation. */
function createFetchRecordTool(log: ToolLogEntry[]) {
  return createTool({
    id: 'fetchRecord',
    description: 'Fetch a record by name. Slow.',
    inputSchema: z.object({ name: z.string() }),
    background: { enabled: true },
    execute: async ({ name }: { name: string }) => {
      log.push({ tool: 'fetchRecord', event: 'start', name });
      await new Promise(r => setTimeout(r, FETCH_DELAY_MS));
      log.push({ tool: 'fetchRecord', event: 'commit', name });
      return { name, amount: 42 };
    },
  });
}

/** The harness's script: a new deferred dispatch on every call until CAP, then text. */
function createScriptModel(next: () => { toolCall: string } | { text: string }) {
  return new MockLanguageModelV2({
    doStream: async () => {
      const step = next();
      const parts: unknown[] = [
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 't30-response', modelId: 't30-model', timestamp: new Date(0) },
      ];
      if ('toolCall' in step) {
        parts.push(
          {
            type: 'tool-call',
            toolCallId: step.toolCall,
            toolName: 'fetchRecord',
            input: JSON.stringify({ name: step.toolCall, _background: { disposition: 'deferred' } }),
          },
          { type: 'finish', finishReason: 'tool-calls', usage: USAGE },
        );
      } else {
        parts.push(
          { type: 'text-start', id: 't30-text' },
          { type: 'text-delta', id: 't30-text', delta: step.text },
          { type: 'text-end', id: 't30-text' },
          { type: 'finish', finishReason: 'stop', usage: USAGE },
        );
      }
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream(parts as any[]),
      };
    },
  });
}

type Chunk = { type: string; payload?: { error?: { message?: string } } };
type T30Run = { chunks: Chunk[]; log: ToolLogEntry[]; modelCalls: number; threw: string | null };
type T30Contract = {
  modelCalls: number;
  dispatched: number;
  segments: number;
  finish: number;
  completed: number;
  errors: string[];
  threw: string | null;
  cappedBy: 'harness' | 'product';
};

async function runOnEngine(engine: Engine, variant: Variant): Promise<T30Run> {
  const log: ToolLogEntry[] = [];
  let calls = 0;
  const next = () => (calls++ < CAP ? { toolCall: `t30-${calls}` } : { text: 'capped by harness' });

  const agent = new Agent({
    id: 't30-agent',
    name: 't30',
    instructions: 'Go.',
    model: createScriptModel(next),
    memory: new MockMemory(),
    tools: { fetchRecord: createFetchRecordTool(log) },
  });

  const pubsub = engine === 'durable' ? new EventEmitterPubSub() : undefined;
  const runner = engine === 'durable' ? createDurableAgent({ agent, pubsub }) : agent;

  // The harness host: background workers must be enabled and started or a
  // deferred dispatch degrades to a foreground call and the case is vacuous.
  const host = new Mastra({
    agents: { [agent.id]: runner as any },
    storage: new InMemoryStore(),
    logger: false,
    backgroundTasks: { enabled: true },
  });
  await host.startWorkers();

  let threw: string | null = null;
  const chunks: Chunk[] = [];
  try {
    const result = (await (runner as any).stream('Go.', {
      memory: { thread: `t30-thread-${engine}`, resource: `t30-resource-${engine}` },
      runId: `t30-run-${engine}`,
      untilIdle: { maxIdleMs: IDLE_MS },
      maxSteps: variant === 'max-steps' ? 3 : 20,
    })) as { fullStream: AsyncIterable<Chunk>; cleanup?: () => void | Promise<void> };
    for await (const chunk of result.fullStream) chunks.push(chunk);
    await result.cleanup?.();
  } catch (error) {
    threw = String((error as Error)?.message ?? error).slice(0, 200);
  } finally {
    await host.shutdown();
    await pubsub?.close();
  }

  return { chunks, log, modelCalls: calls, threw };
}

/** Every check from the harness's `evaluate()`, asserted per engine. */
function assertHarnessChecks(where: string, run: T30Run): T30Contract {
  const { chunks, log, modelCalls, threw } = run;
  const starts = log.filter(e => e.tool === 'fetchRecord' && e.event === 'start').length;
  const errors = chunks.filter(c => c.type === 'error').map(c => String(c.payload?.error?.message ?? '').slice(0, 120));
  const contract: T30Contract = {
    modelCalls,
    dispatched: starts,
    segments: chunks.filter(c => c.type === 'start').length,
    finish: chunks.filter(c => c.type === 'finish').length,
    completed: chunks.filter(c => c.type === 'background-task-completed').length,
    errors,
    threw,
    cappedBy: modelCalls > CAP ? 'harness' : 'product',
  };

  expect(
    contract.finish >= 1 || errors.length > 0 || !!threw,
    `${where}: run settled (finished or errored, never hung to the deadline)`,
  ).toBe(true);
  expect(starts, `${where}: the loop did wake up at least twice (the scenario was exercised)`).toBeGreaterThanOrEqual(
    2,
  );

  // Vacuity guard beyond the harness checks: a foreground fallback still
  // dispatches tools and still settles, so assert that the tasks really ran in
  // the background and that waiting for them opened extra segments.
  expect(contract.completed, `${where}: the background tasks completed`).toBeGreaterThan(0);
  expect(contract.segments, `${where}: untilIdle opened a segment per wake-up`).toBeGreaterThan(1);

  return contract;
}

describe('T30 untilIdle wake-up ceiling', () => {
  for (const variant of VARIANTS) {
    it(`${variant}: the wake-up loop settles and records how many segments it allowed`, async () => {
      const observed = new Map<Engine, T30Contract>();
      for (const engine of ENGINES) {
        observed.set(engine, assertHarnessChecks(`${engine}/${variant}`, await runOnEngine(engine, variant)));
      }

      // The script's own cap is what ended the run: the loop kept re-dispatching until the harness
      // stopped answering, rather than settling on its own.
      for (const engine of ENGINES) {
        expect(observed.get(engine)!.cappedBy, `${engine}/${variant}: the script's cap ended the run`).toBe('harness');
      }

      // The harness compares the contract, not the chunk payloads.
      expect(observed.get('durable'), `${variant}: durable contract`).toEqual(observed.get('plain'));
    });
  }
});
