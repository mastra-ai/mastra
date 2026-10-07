/**
 * Ported from validation harness case T19 (until-idle-replay).
 *
 * F9, isolated: a deferred background task finishes while the stream waits with
 * `untilIdle`, which wakes the loop for a new segment. With a caller-supplied
 * `runId` the continuation reuses it and must not replay the previous segment's
 * chunks; without one each segment gets its own runId. Either way the tool call
 * and each segment's text are streamed exactly once.
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
 * T19 excludes exact timing from its claims and no check depends on the duration.
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
import { createEventedAgent } from '../create-evented-agent';

const ENGINES = ['plain', 'durable', 'evented'] as const;
type Engine = (typeof ENGINES)[number];

const VARIANT = ['caller-runid', 'no-runid'] as const;
type Variant = (typeof VARIANT)[number];

const MAX_STEPS = 6;
const IDLE_MS = 20_000;
/** The harness's `FETCH_DELAY_MS` is 1500; 400 keeps the port CI-viable. */
const FETCH_DELAY_MS = 400;
const USAGE = { inputTokens: 1, outputTokens: 1, totalTokens: 2 } as const;

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

/** The harness's `createScriptModel` for this case: a pure function of the prompt. */
function createScriptModel() {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }: { prompt: readonly { role?: string; content?: unknown }[] }) => {
      const results = toolResults(prompt);
      const parts: unknown[] = [
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 't19-response', modelId: 't19-model', timestamp: new Date(0) },
      ];
      if (JSON.stringify(results).includes('"amount":42')) {
        parts.push(
          { type: 'text-start', id: 't19-text' },
          { type: 'text-delta', id: 't19-text', delta: 'amount 42' },
          { type: 'text-end', id: 't19-text' },
          { type: 'finish', finishReason: 'stop', usage: USAGE },
        );
      } else if (results.length > 0) {
        parts.push(
          { type: 'text-start', id: 't19-text' },
          { type: 'text-delta', id: 't19-text', delta: 'waiting' },
          { type: 'text-end', id: 't19-text' },
          { type: 'finish', finishReason: 'stop', usage: USAGE },
        );
      } else {
        parts.push(
          {
            type: 'tool-call',
            toolCallId: 't19-call-1',
            toolName: 'fetchRecord',
            input: JSON.stringify({ name: 'comparison', _background: { disposition: 'deferred' } }),
          },
          { type: 'finish', finishReason: 'tool-calls', usage: USAGE },
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

type Chunk = { type: string; payload?: { toolName?: string; toolCallId?: string; text?: string } };
type T19Run = { chunks: Chunk[]; log: ToolLogEntry[] };
type T19Contract = { calls: number; waiting: number; final: number };

async function runOnEngine(engine: Engine, variant: Variant): Promise<T19Run> {
  const log: ToolLogEntry[] = [];
  const agent = new Agent({
    id: 't19-agent',
    name: 't19',
    instructions: 'Fetch the comparison record.',
    model: createScriptModel(),
    memory: new MockMemory(),
    tools: { fetchRecord: createFetchRecordTool(log) },
  });

  const pubsub = engine === 'durable' ? new EventEmitterPubSub() : undefined;
  const runner =
    engine === 'plain'
      ? agent
      : engine === 'durable'
        ? createDurableAgent({ agent, pubsub })
        : createEventedAgent({ agent });

  // The harness host: background workers must be enabled and started or a
  // deferred dispatch degrades to a foreground call and the case is vacuous.
  const host = new Mastra({
    agents: { [agent.id]: runner as any },
    storage: new InMemoryStore(),
    logger: false,
    backgroundTasks: { enabled: true },
  });
  await host.startWorkers();

  if (engine === 'evented') {
    // Without atomic storage the evented agent silently runs on the default engine, which would
    // make "evented == plain" a durable-vs-plain comparison.
    const engineType = (runner as { getWorkflow?: () => { engineType?: string } }).getWorkflow?.().engineType;
    expect(engineType, 'evented workflow engine type').toBe('evented');
  }

  try {
    const options: Record<string, unknown> = {
      memory: { thread: `t19-thread-${engine}`, resource: `t19-resource-${engine}` },
      untilIdle: { maxIdleMs: IDLE_MS },
      maxSteps: MAX_STEPS,
    };
    if (variant === 'caller-runid') options.runId = `t19-run-${engine}`;

    const result = (await (runner as any).stream('Fetch the comparison record.', options)) as {
      fullStream: AsyncIterable<Chunk>;
      cleanup?: () => void | Promise<void>;
    };
    const chunks: Chunk[] = [];
    for await (const chunk of result.fullStream) chunks.push(chunk);
    await result.cleanup?.();
    return { chunks, log };
  } finally {
    await host.shutdown();
    await pubsub?.close();
  }
}

/** Every check from the harness's `evaluate()`, asserted per engine. */
function assertHarnessChecks(where: string, run: T19Run): T19Contract {
  const { chunks, log } = run;
  const calls = chunks
    .filter(c => c.type === 'tool-call' && c.payload?.toolName === 'fetchRecord')
    .map(c => c.payload?.toolCallId);
  const waiting = chunks.filter(c => c.type === 'text-delta' && c.payload?.text === 'waiting').length;
  const final = chunks.filter(c => c.type === 'text-delta' && c.payload?.text === 'amount 42').length;
  const commits = log.filter(e => e.tool === 'fetchRecord' && e.event === 'commit').length;

  expect(commits, `${where}: background task ran once`).toBe(1);
  expect(calls.length, `${where}: the tool call is streamed once (F9)`).toBe(1);
  expect(waiting, `${where}: the first segment's text is streamed once (F9)`).toBe(1);
  expect(final, `${where}: the woken segment reported the result`).toBe(1);

  // Vacuity guard beyond the harness checks: the harness's own counts are
  // identical when the deferred dispatch degrades to a foreground call, so
  // assert that the task really did run in the background and that waiting for
  // it opened a second segment.
  const dispatched = chunks.filter(c => c.type === 'background-task-started').length;
  const completed = chunks.filter(c => c.type === 'background-task-completed').length;
  const segments = chunks.filter(c => c.type === 'start').length;
  expect(dispatched, `${where}: the task was dispatched to the background`).toBeGreaterThan(0);
  expect(completed, `${where}: the background task completed before the run settled`).toBeGreaterThan(0);
  expect(segments, `${where}: untilIdle woke the loop for a second segment`).toBeGreaterThan(1);

  return { calls: calls.length, waiting, final };
}

describe('T19 untilIdle continuation does not replay earlier chunks', () => {
  for (const variant of VARIANT) {
    it(`${variant}: background wake-up streams each segment once on every engine`, async () => {
      const observed = new Map<Engine, T19Contract>();
      for (const engine of ENGINES) {
        observed.set(engine, assertHarnessChecks(`${engine}/${variant}`, await runOnEngine(engine, variant)));
      }

      // The harness compares the contract, not the chunk payloads.
      expect(observed.get('durable'), `${variant}: durable contract`).toEqual(observed.get('plain'));
      expect(observed.get('evented'), `${variant}: evented contract`).toEqual(observed.get('plain'));
    });
  }
});
