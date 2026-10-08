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
 * The harness greens even when chunk payloads diverge, so this port asserts every
 * harness `evaluate()` check per engine and reproduces the harness's
 * `done(contract)` cross-engine deep-equality on top of it.
 *
 * The case runs through `expectEngineParity` on a host with
 * `host: { backgroundTasks: { enabled: true } }`, which is what makes the helper
 * bind a `BackgroundTaskManager` and call `startWorkers()`. Without that a
 * deferred dispatch degrades silently to a foreground call and every check here
 * would pass without ever exercising the wake-up path.
 *
 * Timing note: the harness's artificial 1500 ms tool delay is reduced to 400 ms.
 * T30 excludes exact timing from its claims and no check depends on the duration.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../../memory/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import type { EngineDifference, ModelScript, ParityEngine, ParitySnapshot } from './parity-harness';
import { expectEngineParity, textOnlyTape, toolCallTape } from './parity-harness';

/** The harness excludes evented (`background workers; T4e`). */
const ENGINES = ['plain', 'durable'] as const;

const VARIANTS = ['unbounded', 'max-steps'] as const;

const CAP = 6;
const IDLE_MS = 20_000;
/** The harness's `FETCH_DELAY_MS` is 1500; 400 keeps the port CI-viable. */
const FETCH_DELAY_MS = 400;
const USAGE = { inputTokens: 1, outputTokens: 1, totalTokens: 2 } as const;

/** One thread for both engines: the harness compares contracts, not request metadata. */
const MEMORY = { thread: 't30-thread', resource: 't30-resource' };

/**
 * COR-1390: on the deferred-dispatch path plain keeps the placeholder
 * `tool-result` inside the step and the wrapped engines stream
 * `background-task-progress` and flush the completed result after `step-finish`
 * instead; the `taskId` itself is a per-engine UUID.
 */
const COR_1390_BACKGROUND = {
  reason:
    'COR-1390: wrapped engines stream background-task-progress and flush the completed result after step-finish where plain keeps the placeholder; taskId is a per-engine stubbed UUID.',
  ignore: ['chunks', 'chunkTypes', 'chunkPayloads', 'toolResults', 'requests'],
} satisfies EngineDifference;

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
const T30_SCRIPT: ModelScript = {
  respond: (_request, callIndex) =>
    callIndex <= CAP
      ? toolCallTape(
          'fetchRecord',
          { name: `t30-${callIndex}`, _background: { disposition: 'deferred' } },
          `t30-${callIndex}`,
          USAGE,
        )
      : textOnlyTape('capped by harness', USAGE),
};

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

function countType(turn: ParitySnapshot, type: string): number {
  return turn.chunkTypes.filter(chunkType => chunkType === type).length;
}

/**
 * The `error` chunk payload is the error itself (plain hands over the live
 * `Error`, the wrapped engines its serialised shape), so accept both.
 */
function errorMessages(turn: ParitySnapshot): string[] {
  const messages: string[] = [];
  turn.chunkTypes.forEach((type, index) => {
    if (type !== 'error') return;
    const payload = turn.chunkPayloads[index] as { message?: unknown; error?: { message?: unknown } } | undefined;
    const message = payload?.error?.message ?? payload?.message;
    if (message !== undefined) messages.push(String(message).slice(0, 120));
  });
  return messages;
}

/** Every check from the harness's `evaluate()`, plus the vacuity guards it cannot express. */
function contractOf(where: string, turn: ParitySnapshot, log: ToolLogEntry[], modelCalls: number): T30Contract {
  const starts = log.filter(entry => entry.tool === 'fetchRecord' && entry.event === 'start').length;
  const errors = errorMessages(turn);
  const threw = turn.error ? turn.error.message.slice(0, 200) : null;
  const contract: T30Contract = {
    modelCalls,
    dispatched: starts,
    segments: countType(turn, 'start'),
    finish: countType(turn, 'finish'),
    completed: countType(turn, 'background-task-completed'),
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
      const logs = new Map<ParityEngine, ToolLogEntry[]>();

      const results = await expectEngineParity({
        engines: ENGINES,
        model: T30_SCRIPT,
        host: { backgroundTasks: { enabled: true } },
        differences: { durable: COR_1390_BACKGROUND },
        buildAgent: ({ engine, model }) => {
          const log: ToolLogEntry[] = [];
          logs.set(engine, log);
          return new Agent({
            id: 't30-agent',
            name: 't30',
            instructions: 'Go.',
            model,
            memory: new MockMemory(),
            tools: { fetchRecord: createFetchRecordTool(log) },
          });
        },
        run: async handle => {
          await handle.turn('Go.', {
            memory: MEMORY,
            runId: `t30-run-${handle.engine}`,
            untilIdle: { maxIdleMs: IDLE_MS },
            maxSteps: variant === 'max-steps' ? 3 : 20,
          });
        },
      });

      const observed = new Map<ParityEngine, T30Contract>();
      for (const engine of ENGINES) {
        const result = results[engine];
        expect(result, `${engine} ran`).toBeDefined();
        observed.set(
          engine,
          contractOf(`${engine}/${variant}`, result!.turns[0]!, logs.get(engine)!, result!.requests.length),
        );
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
