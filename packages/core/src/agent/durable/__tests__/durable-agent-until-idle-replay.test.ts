/**
 * Ported from validation harness case T19 (until-idle-replay).
 *
 * F9, isolated: a deferred background task finishes while the stream waits with
 * `untilIdle`, which wakes the loop for a new segment. With a caller-supplied
 * `runId` the continuation reuses it and must not replay the previous segment's
 * chunks; without one each segment gets its own runId. Either way the tool call
 * and each segment's text are streamed exactly once.
 *
 * The harness greens even when chunk payloads diverge, so this port asserts every
 * harness `evaluate()` check per engine and reproduces the harness's
 * `done(contract)` cross-engine deep-equality on top of it.
 *
 * The case runs through `expectEngineParity` on a host with
 * `host: { backgroundTasks: { enabled: true } }`, which is what makes the helper
 * bind a `BackgroundTaskManager` and call `startWorkers()`. Without that a
 * deferred dispatch degrades silently to a foreground call and every check here
 * would pass without ever exercising the wake-up path (the helper's own
 * background self-test documents the same trap).
 *
 * Timing note: the harness's artificial 1500 ms tool delay is reduced to 400 ms.
 * T19 excludes exact timing from its claims and no check depends on the duration.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../../memory/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import type { EngineDifference, ModelScript, ParityEngine, ParitySnapshot } from './parity-harness';
import { expectEngineParity, textOnlyTape, toolCallTape } from './parity-harness';

const ENGINES = ['plain', 'durable', 'evented'] as const;

const VARIANT = ['caller-runid', 'no-runid'] as const;

const MAX_STEPS = 6;
const IDLE_MS = 20_000;
/** The harness's `FETCH_DELAY_MS` is 1500; 400 keeps the port CI-viable. */
const FETCH_DELAY_MS = 400;
const USAGE = { inputTokens: 1, outputTokens: 1, totalTokens: 2 } as const;

/**
 * One thread for all three engines: the prompt carries the thread id in its
 * headers, and the harness compares contracts rather than request metadata.
 */
const MEMORY = { thread: 't19-thread', resource: 't19-resource' };

type ToolLogEntry = { tool: string; event: string; name: string };

/** The harness reads the script's decision from tool results, never the prompt text. */
function toolResults(prompt: readonly { role?: string; content?: unknown }[]): unknown[] {
  const results: unknown[] = [];
  for (const message of prompt) {
    if (message.role !== 'tool' || !Array.isArray(message.content)) continue;
    for (const part of message.content as { type?: string }[]) {
      if (part.type === 'tool-result') results.push(part);
    }
  }
  return results;
}

/** The harness's `createScriptModel` for this case: a pure function of the prompt. */
const T19_SCRIPT: ModelScript = {
  respond: request => {
    const results = toolResults(request.prompt);
    if (JSON.stringify(results).includes('"amount":42')) return textOnlyTape('amount 42', USAGE);
    if (results.length > 0) return textOnlyTape('waiting', USAGE);
    return toolCallTape(
      'fetchRecord',
      { name: 'comparison', _background: { disposition: 'deferred' } },
      't19-call-1',
      USAGE,
    );
  },
};

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

/** Counts text deltas carrying exactly `text`. */
function textDeltas(turn: ParitySnapshot, text: string): number {
  return turn.chunkTypes.filter((type, index) => {
    if (type !== 'text-delta') return false;
    const payload = turn.chunkPayloads[index] as { text?: string } | undefined;
    return payload?.text === text;
  }).length;
}

type T19Contract = { calls: number; waiting: number; final: number };

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

/** Every check from the harness's `evaluate()`, plus the vacuity guards it cannot express. */
function contractOf(where: string, turn: ParitySnapshot, log: ToolLogEntry[]): T19Contract {
  const calls = turn.toolCalls.filter(call => call.toolName === 'fetchRecord').length;
  const waiting = textDeltas(turn, 'waiting');
  const final = textDeltas(turn, 'amount 42');
  const commits = log.filter(entry => entry.tool === 'fetchRecord' && entry.event === 'commit').length;

  expect(commits, `${where}: background task ran once`).toBe(1);
  expect(calls, `${where}: the tool call is streamed once (F9)`).toBe(1);
  expect(waiting, `${where}: the first segment's text is streamed once (F9)`).toBe(1);
  expect(final, `${where}: the woken segment reported the result`).toBe(1);
  expect(turn.error, `${where}: the run settled normally`).toBeUndefined();

  // Vacuity guard beyond the harness checks: the harness's own counts are
  // identical when the deferred dispatch degrades to a foreground call, so
  // assert that the task really did run in the background and that waiting for
  // it opened a second segment.
  const dispatched = turn.chunkTypes.filter(type => type === 'background-task-started').length;
  const completed = turn.chunkTypes.filter(type => type === 'background-task-completed').length;
  const segments = turn.chunkTypes.filter(type => type === 'start').length;
  expect(dispatched, `${where}: the task was dispatched to the background`).toBeGreaterThan(0);
  expect(completed, `${where}: the background task completed before the run settled`).toBeGreaterThan(0);
  expect(segments, `${where}: untilIdle woke the loop for a second segment`).toBeGreaterThan(1);

  return { calls, waiting, final };
}

describe('T19 untilIdle continuation does not replay earlier chunks', () => {
  for (const variant of VARIANT) {
    it(`${variant}: background wake-up streams each segment once on every engine`, async () => {
      const logs = new Map<ParityEngine, ToolLogEntry[]>();

      const results = await expectEngineParity({
        engines: ENGINES,
        model: T19_SCRIPT,
        host: { backgroundTasks: { enabled: true } },
        differences: { durable: COR_1390_BACKGROUND, evented: COR_1390_BACKGROUND },
        buildAgent: ({ engine, model }) => {
          const log: ToolLogEntry[] = [];
          logs.set(engine, log);
          return new Agent({
            id: 't19-agent',
            name: 't19',
            instructions: 'Fetch the comparison record.',
            model,
            memory: new MockMemory(),
            tools: { fetchRecord: createFetchRecordTool(log) },
          });
        },
        run: async handle => {
          await handle.turn('Fetch the comparison record.', {
            memory: MEMORY,
            untilIdle: { maxIdleMs: IDLE_MS },
            maxSteps: MAX_STEPS,
            ...(variant === 'caller-runid' ? { runId: `t19-run-${handle.engine}` } : {}),
          });
        },
      });

      const observed = new Map<ParityEngine, T19Contract>();
      for (const engine of ENGINES) {
        const result = results[engine];
        expect(result, `${engine} ran`).toBeDefined();
        observed.set(engine, contractOf(`${engine}/${variant}`, result!.turns[0]!, logs.get(engine)!));
      }

      // The harness compares the contract, not the chunk payloads.
      expect(observed.get('durable'), `${variant}: durable contract`).toEqual(observed.get('plain'));
      expect(observed.get('evented'), `${variant}: evented contract`).toEqual(observed.get('plain'));
    });
  }
});
