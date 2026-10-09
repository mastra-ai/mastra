/**
 * Ported from validation harness case T85 (usage-detail-counters).
 *
 * COR-1246 (GH #23469): detail usage counters are additive once reported, unlike
 * the primary counters whose omission makes the aggregate unknown. A call that
 * omits a detail contributes zero after the detail has been seen, while a detail
 * omitted by every call must stay absent rather than appear as a misleading zero
 * or as an own property whose value is undefined.
 *
 * The main legs run every variant on plain, durable and evented through
 * `expectEngineParity`; each asserts every harness `evaluate()` check per engine
 * and reproduces the harness's `done(contract)` deep-equality across engines.
 *
 * The recovery legs (`durable-recover`, `evented-recover`) restart a run that is
 * cut off inside step 2's tool call, using the shared `restart-harness.ts`
 * unchanged. The harness runs both `sigkill` and `inprocess` mechanisms per cell
 * (16 recovery cells); the frozen in-process restart harness simulates fresh
 * singletons over the persisted snapshot, not process death, so it cannot model a
 * `sigkill`. The port therefore runs one restart test per engine and variant — 8
 * cells — with the mechanism collapsed, matching the T20 port's precedent. This is
 * an explicit scope reduction, not a weakened check: every assertion the harness
 * makes on a recovery cell still runs, just once instead of twice.
 *
 * Two further expressibility notes:
 * - `restart-harness.ts` reports only the resolved full-output usage, not a separate
 *   terminal finish-chunk usage, so the recovery legs assert the resolved usage
 *   values and key sets and *skip* the harness's "terminal finish usage equals the
 *   resolved full output usage" comparison rather than faking it. That comparison is
 *   asserted on all twelve main cells, where both surfaces are visible.
 * - Like the T20 port, the recovery legs run without Memory (recovery reads the
 *   conversation from the persisted snapshot); no T85 claim depends on memory.
 */

import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../../memory/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import type { CapturedRequest, ModelScript, ModelTape, ParityEngine, ParityStreamOptions } from './parity-harness';
import { expectEngineParity } from './parity-harness';
import { createGate, createRestartScenario } from './restart-harness';
import type { Gate } from './restart-harness';

const ENGINES: ParityEngine[] = ['plain', 'durable', 'evented'];

type Variant = 'details-present' | 'details-known-then-omitted' | 'details-omitted-then-known' | 'details-absent';

// Verbatim from the harness case.
const PRIMARY_BY_CALL = [
  { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
  { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
  { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
];
const DETAILS_BY_CALL = [
  {
    reasoningTokens: 5,
    cachedInputTokens: 7,
    cacheCreationInputTokens: 11,
    cacheCreationInputTokens5m: 13,
    cacheCreationInputTokens1h: 17,
  },
  {
    reasoningTokens: 50,
    cachedInputTokens: 70,
    cacheCreationInputTokens: 110,
    cacheCreationInputTokens5m: 130,
    cacheCreationInputTokens1h: 170,
  },
  {
    reasoningTokens: 500,
    cachedInputTokens: 700,
    cacheCreationInputTokens: 1100,
    cacheCreationInputTokens5m: 1300,
    cacheCreationInputTokens1h: 1700,
  },
];
const DETAIL_KEYS = [
  'reasoningTokens',
  'cachedInputTokens',
  'cacheCreationInputTokens',
  'cacheCreationInputTokens5m',
  'cacheCreationInputTokens1h',
] as const;
const ASSERTED_DETAIL_KEYS = ['reasoningTokens', 'cachedInputTokens', 'cacheCreationInputTokens'] as const;
const EXPECTED_DETAILS: Record<Exclude<Variant, 'details-absent'>, Record<string, number>> = {
  'details-present': { reasoningTokens: 555, cachedInputTokens: 777, cacheCreationInputTokens: 1221 },
  'details-known-then-omitted': { reasoningTokens: 5, cachedInputTokens: 7, cacheCreationInputTokens: 11 },
  'details-omitted-then-known': { reasoningTokens: 550, cachedInputTokens: 770, cacheCreationInputTokens: 1210 },
};

type Usage = Record<string, number | undefined>;

/** The harness's `detailsFor(variant, call)`. */
function detailsFor(variant: Variant, call: number): Record<string, number> | undefined {
  if (variant === 'details-absent') return undefined;
  if (variant === 'details-known-then-omitted') return call === 0 ? DETAILS_BY_CALL[call] : undefined;
  if (variant === 'details-omitted-then-known') return call === 0 ? undefined : DETAILS_BY_CALL[call];
  return DETAILS_BY_CALL[call];
}

/** The harness's `usageFor(variant, call)`. */
function usageFor(variant: Variant, call: number): Usage {
  const primary = PRIMARY_BY_CALL[call] ?? PRIMARY_BY_CALL.at(-1)!;
  const details = detailsFor(variant, call);
  return details ? { ...primary, ...details } : { ...primary };
}

/** Property insertion order is not part of the usage contract; key sets and values are. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .map(key => [key, canonical(record[key])]),
  );
}

const sortedKeys = (value: unknown) => Object.keys((value ?? {}) as Record<string, unknown>).sort();

/** Tool results already in the prompt, like the harness's `toolResults(p)`. */
function toolResultCount(request: CapturedRequest): number {
  let count = 0;
  for (const message of request.prompt) {
    if (message.role !== 'tool' || !Array.isArray(message.content)) continue;
    count += message.content.filter(part => part.type === 'tool-result').length;
  }
  return count;
}

function textTape(text: string, usage: Usage): ModelTape {
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id: 't85-id', modelId: 't85-model', timestamp: new Date(0) },
    { type: 'text-start', id: 't85-text' },
    { type: 'text-delta', id: 't85-text', delta: text },
    { type: 'text-end', id: 't85-text' },
    { type: 'finish', finishReason: 'stop', usage },
  ];
}

function toolTape(callId: string, n: number, usage: Usage): ModelTape {
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id: 't85-id-tool', modelId: 't85-model', timestamp: new Date(0) },
    {
      type: 'tool-call',
      toolCallId: callId,
      toolName: 'step',
      input: JSON.stringify({ n }),
      providerExecuted: false,
    },
    { type: 'finish', finishReason: 'tool-calls', usage },
  ];
}

/** The harness script: two `step` tool calls, then `done`, with usage driven by the prompt. */
function script(variant: Variant): ModelScript {
  return {
    respond: (request, callIndex) => {
      const completed = toolResultCount(request);
      const usage = usageFor(variant, completed);
      return completed < 2 ? toolTape(`t85-call-${callIndex + 1}`, completed + 1, usage) : textTape('done', usage);
    },
  };
}

type Commit = { tool: 'step'; event: 'commit'; n: number };

function createStepTool(log: Commit[]): ReturnType<typeof createTool> {
  return createTool({
    id: 'step',
    description: 'Take a numbered step.',
    inputSchema: z.object({ n: z.number() }),
    execute: async ({ n }) => {
      log.push({ tool: 'step', event: 'commit', n });
      return { done: n };
    },
  });
}

/** The harness `evaluate()` checks, split so the same assertions run on a parity turn. */
type Surfaces = {
  text: string | null;
  usage: Usage | null;
  /**
   * The terminal finish chunk's usage. `undefined` means this surface is not exposed by the
   * driver (the recovery legs, whose `restart-harness.ts` reports only the resolved full-output
   * usage); the terminal-vs-resolved comparison is then skipped and recorded as not ported.
   */
  terminalUsage?: Usage | null;
  finishes: number;
  commits: number[];
  modelCalls: number;
  variant: Variant;
};

function assertHarnessChecks(where: string, surfaces: Surfaces) {
  const { text, usage, terminalUsage, finishes, commits, modelCalls, variant } = surfaces;

  expect(text, `${where}: the scripted answer is in the run`).toBe('done');
  expect(finishes, `${where}: the public stream settled with exactly one finish`).toBe(1);
  expect(commits.join(','), `${where}: each tool side effect committed exactly once`).toBe('1,2');
  expect(
    usage?.inputTokens === 111 && usage?.outputTokens === 222 && usage?.totalTokens === 333,
    `${where}: primary usage remains complete while detail behavior is isolated`,
  ).toBe(true);

  const usageKeys = sortedKeys(usage);
  if (variant === 'details-absent') {
    for (const key of DETAIL_KEYS) {
      expect(usageKeys.includes(key), `${where}: ${key} stays absent when no call reports it`).toBe(false);
    }
  } else {
    const expected = EXPECTED_DETAILS[variant];
    for (const key of ASSERTED_DETAIL_KEYS) {
      expect(usage?.[key], `${where}: ${key} sums only the calls that report it`).toBe(expected[key]);
      expect(usageKeys.includes(key), `${where}: ${key} stays present after it is first reported`).toBe(true);
    }
  }

  // The harness asserts "terminal finish usage equals the resolved full output usage" and the
  // matching key sets on every cell. That needs both surfaces; `restart-harness.ts` exposes only
  // the resolved full-output usage, so the recovery legs (where `terminalUsage` is `undefined`)
  // assert the resolved surface above and skip — rather than fake — this comparison.
  if (terminalUsage !== undefined) {
    expect(
      JSON.stringify(canonical(terminalUsage)),
      `${where}: terminal finish usage equals the resolved full output usage`,
    ).toBe(JSON.stringify(canonical(usage)));
    expect(
      sortedKeys(terminalUsage).join(','),
      `${where}: terminal finish and resolved usage expose the same keys`,
    ).toBe(usageKeys.join(','));
  }

  expect(modelCalls, `${where}: the run reached the third model call`).toBeGreaterThanOrEqual(3);
}

describe('T85 detail usage counters', () => {
  for (const variant of [
    'details-present',
    'details-known-then-omitted',
    'details-omitted-then-known',
    'details-absent',
  ] as const) {
    it(`${variant}: every harness check holds on every engine`, async () => {
      const logs = new Map<ParityEngine, Commit[]>();
      const results = await expectEngineParity({
        engines: ENGINES,
        model: script(variant),
        buildAgent: ({ engine, model }) => {
          const log: Commit[] = [];
          logs.set(engine, log);
          return new Agent({
            id: `t85-${variant}`,
            name: `t85-${variant}`,
            instructions: 'Follow the script.',
            model,
            tools: { step: createStepTool(log) },
            memory: new MockMemory(),
          }) as unknown as Agent<string, any, any>;
        },
        input: 'Go.',
        options: { runId: `t85-run-${variant}`, maxSteps: 5 } as ParityStreamOptions,
      });

      const observed: Record<string, unknown> = {};
      for (const engine of ENGINES) {
        const result = results[engine];
        expect(result, `${engine} results`).toBeDefined();
        const turn = result!.turns[0]!;
        const usage = (turn.fullOutput.usage ?? null) as Usage | null;
        const terminalUsage = (turn.finishChunk.usage ?? null) as Usage | null;
        const commits = (logs.get(engine) ?? []).map(entry => entry.n);
        const finishes = turn.chunkTypes.filter(type => type === 'finish').length;

        assertHarnessChecks(engine, {
          text: turn.text,
          usage,
          terminalUsage,
          finishes,
          commits,
          modelCalls: result!.requests.length,
          variant,
        });

        observed[engine] = {
          variant,
          usage: canonical(usage),
          usageKeys: sortedKeys(usage),
          perCallUsage: canonical([0, 1, 2].map(call => usageFor(variant, call))),
          finishPayloads: canonical([{ usage: terminalUsage, usageKeys: sortedKeys(terminalUsage) }]),
          text: turn.text,
          finishes,
          modelCalls: result!.requests.length,
          postRestartCalls: 0,
          commits,
        };
      }
      // The harness's `pair(plain, other)` contract deep-equality.
      expect(observed.durable, 'durable contract').toEqual(observed.plain);
      expect(observed.evented, 'evented contract').toEqual(observed.plain);
    });
  }
});

// --- Recovery legs ---------------------------------------------------------

// A fresh in-process script model per graph; `modelCalls` counts calls per generation.
function createRecoveryModel(variant: Variant, modelCalls: Map<number, number>, generation: number) {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      modelCalls.set(generation, (modelCalls.get(generation) ?? 0) + 1);
      let completed = 0;
      for (const message of prompt as Array<{ role: string; content?: unknown }>) {
        if (message.role !== 'tool' || !Array.isArray(message.content)) continue;
        completed += (message.content as Array<{ type: string }>).filter(part => part.type === 'tool-result').length;
      }
      const usage = usageFor(variant, completed);
      const head = [
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: `t85-recover-${completed}`, modelId: 't85-model', timestamp: new Date(0) },
      ];
      const parts =
        completed < 2
          ? [
              ...head,
              {
                type: 'tool-call',
                toolCallId: `t85-recover-${completed + 1}`,
                toolName: 'step',
                input: JSON.stringify({ n: completed + 1 }),
              },
              { type: 'finish', finishReason: 'tool-calls', usage },
            ]
          : [
              ...head,
              { type: 'text-start', id: 't85-recover-text' },
              { type: 'text-delta', id: 't85-recover-text', delta: 'done' },
              { type: 'text-end', id: 't85-recover-text' },
              { type: 'finish', finishReason: 'stop', usage },
            ];
      return { stream: convertArrayToReadableStream(parts as any[]), rawCall: { rawPrompt: null, rawSettings: {} } };
    },
  });
}

async function drain(fullStream: AsyncIterable<{ type: string }>) {
  for await (const _chunk of fullStream) {
    // Drain graph 1; its fate is not the subject of the recovery legs.
  }
}

const gates: Gate[] = [];
const scenarios: { stop(): Promise<void> }[] = [];
afterEach(async () => {
  // Release graph 1's gate first: a parked tool must not be stopped mid-flight.
  for (const gate of gates.splice(0)) gate.release();
  await Promise.all(scenarios.splice(0).map(scenario => scenario.stop()));
});

describe('T85 detail usage counters across recovery', () => {
  for (const kind of ['durable', 'evented'] as const) {
    for (const variant of [
      'details-present',
      'details-known-then-omitted',
      'details-omitted-then-known',
      'details-absent',
    ] as const) {
      it(`${kind}-recover / ${variant}`, async () => {
        const runId = `t85-${kind}-recover-${variant}`;
        const gate = createGate();
        gates.push(gate);
        const logs = new Map<number, Commit[]>();
        const modelCalls = new Map<number, number>();
        const options = { runId, maxSteps: 5 };

        const scenario = createRestartScenario({
          kind,
          runId,
          build: ({ core, generation }) => {
            const log: Commit[] = [];
            logs.set(generation, log);
            return new core.Agent({
              id: `t85-${variant}`,
              name: 't85',
              instructions: 'Follow the script.',
              model: createRecoveryModel(variant, modelCalls, generation),
              tools: {
                step: core.createTool({
                  id: 'step',
                  description: 'Take a numbered step.',
                  inputSchema: z.object({ n: z.number() }),
                  execute: async ({ n }: { n: number }) => {
                    // Park graph 1 inside step 2's tool call; graph 2 must not park again.
                    // The commit is recorded only once the work finishes, as in the harness
                    // tool, so a step cut off mid-flight never logs a commit.
                    if (generation === 1 && n === 2) await gate.wait();
                    log.push({ tool: 'step', event: 'commit', n });
                    return { done: n };
                  },
                }),
              },
            });
          },
        });
        scenarios.push(scenario);

        const original = await scenario.start(({ agent }) => agent.stream('Go.', options));
        const drained = original.driven
          .then((result: any) => drain(result.fullStream))
          .then(
            () => 'ended' as const,
            () => 'ended' as const,
          );
        const reached = await Promise.race([gate.reached.then(() => 'reached' as const), drained]);
        expect(reached, 'not exercised: run ended before step 2 reached the interruption point').toBe('reached');

        const checkpoint = await original.checkpoint();
        const recovered = await scenario.restart(checkpoint);
        expect(recovered.streamErrors).toEqual([]);
        expect(recovered.executionError).toBeUndefined();

        const usage = (recovered.usage ?? null) as Usage | null;
        const commits = [...(logs.get(1) ?? []), ...(logs.get(2) ?? [])].map(entry => entry.n);
        const finishes = (recovered.chunkTypes ?? []).filter(type => type === 'finish').length;

        assertHarnessChecks(`${kind}-recover/${variant}`, {
          text: recovered.text ?? null,
          usage,
          // `restart-harness.ts` exposes only the resolved full-output usage; the harness's
          // terminal-vs-resolved comparison needs a second surface it does not provide, so it is
          // not ported here (asserted on the main legs instead). See the file header.
          finishes,
          commits,
          modelCalls: (modelCalls.get(1) ?? 0) + (modelCalls.get(2) ?? 0),
          variant,
        });
        expect(modelCalls.get(2) ?? 0, 'recovery emitted a post-restart model call').toBeGreaterThanOrEqual(1);
      }, 30_000);
    }
  }
});
