/**
 * Port of harness case T20 (step-budget-recovery): `maxSteps` is a total budget,
 * including across a restart and under failing completion feedback (COR-1238).
 *
 * The script wants 6 steps and `maxSteps` is 3. On the `*-recover` conditions the
 * run is cut off during step 2's tool call and recovered in a fresh module graph;
 * the recovered run must honour the budget the run started with (3 in total), not
 * grant itself a fresh 3. `ceiling` answers at once and an always-failing
 * completion scorer keeps asking for another step; `maxSteps` must still cap it.
 *
 * Coverage matches the harness conditions exactly: `default` and `ceiling` on
 * each of plain/durable/evented, and `durable-recover`/`evented-recover` on the
 * `default` variant only — the harness declares no `variants` for those two
 * conditions, so the ceiling variant is not a restart cell there either.
 *
 * Excluded, as in the harness: `stopWhen` across a restart (a closure, never
 * persisted) and exact timing. Unlike the harness this runs without Memory
 * (`@mastra/memory` is not a core dependency); recovery reads the conversation
 * from the snapshot, not from memory.
 */

import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createScorer } from '../../../evals';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';
import { createGate, createRestartScenario } from './restart-harness';
import type { CoreGraph, Gate } from './restart-harness';

const MAX = 3;

type Probe = { modelCalls: number; started: number[] };

// Calls `step` for n = 1..count, one per model turn, then answers with every result.
// A pure function of the prompt, like the harness's script model.
function createStepModel(count: number, probe: Probe) {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      probe.modelCalls++;
      const done = prompt
        .filter(m => m.role === 'tool')
        .flatMap(m => m.content)
        .filter(p => p.type === 'tool-result').length;
      const head = [
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: `r-${done}`, modelId: 'script', timestamp: new Date(0) },
      ];
      const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
      const parts =
        done < count
          ? [
              ...head,
              {
                type: 'tool-call',
                toolCallId: `step-${done + 1}`,
                toolName: 'step',
                input: JSON.stringify({ n: done + 1 }),
              },
              { type: 'finish', finishReason: 'tool-calls', usage },
            ]
          : [
              ...head,
              { type: 'text-start', id: 't' },
              { type: 'text-delta', id: 't', delta: `finished ${done} steps` },
              { type: 'text-end', id: 't' },
              { type: 'finish', finishReason: 'stop', usage },
            ];
      return { stream: convertArrayToReadableStream(parts as any[]), rawCall: { rawPrompt: null, rawSettings: {} } };
    },
  });
}

function buildAgent(
  core: Pick<CoreGraph, 'Agent' | 'createTool'>,
  { variant, probe, block }: { variant: Variant; probe: Probe; block?: Gate },
) {
  return new core.Agent({
    id: 't20-agent',
    name: 't20-agent',
    instructions: 'Follow the script.',
    model: createStepModel(variant === 'ceiling' ? 0 : 6, probe),
    tools: {
      step: core.createTool({
        id: 'step',
        description: 'Perform numbered step n.',
        inputSchema: z.object({ n: z.number() }),
        execute: async ({ n }) => {
          probe.started.push(n);
          if (block && n === 2) await block.wait();
          return { done: n };
        },
      }),
    },
  });
}

type Variant = 'default' | 'ceiling';

function streamOptions(runId: string, variant: Variant, scorer: { calls: number }) {
  const options: Record<string, unknown> = { runId, maxSteps: MAX };
  if (variant === 'ceiling') {
    const never = createScorer({ id: 't20-never-complete', description: 'always incomplete' }).generateScore(
      async () => {
        scorer.calls++;
        return 0;
      },
    );
    options.isTaskComplete = { scorers: [never], suppressFeedback: false };
  }
  return options;
}

async function drain(fullStream: AsyncIterable<{ type: string }>) {
  const types: string[] = [];
  for await (const chunk of fullStream) types.push(chunk.type);
  return types;
}

const count = (types: string[], type: string) => types.filter(t => t === type).length;

// The T20 checks. For the cells with a restart mechanism the harness relaxes its
// bounds by one model call, because a restart may legitimately re-issue the call
// it was interrupted in; `restarted` applies that same relaxation here.
function evaluate({
  variant,
  types,
  probe,
  scorerCalls,
  restarted,
}: {
  variant: Variant;
  types: string[];
  probe: Probe;
  scorerCalls: number;
  restarted: boolean;
}) {
  const started = [...new Set(probe.started)];
  expect(count(types, 'finish'), `run settled with exactly one finish: ${types.join(',')}`).toBe(1);
  if (variant === 'ceiling') {
    expect(scorerCalls, 'completion scorer ran').toBeGreaterThanOrEqual(1);
    expect(probe.modelCalls, `maxSteps=${MAX} is a hard ceiling on model calls`).toBeLessThanOrEqual(MAX);
    // Not exercised is not a pass.
    expect(probe.modelCalls, 'completion feedback asked for another step').toBeGreaterThanOrEqual(2);
    // The script answers at once, so the budget is spent on feedback, not steps.
    expect(started, 'the script answered at once, so no tool step ran').toEqual([]);
    return;
  }
  const noStepBeyondTheBudget = () =>
    expect(
      started.every(n => n <= MAX),
      `no step beyond the budget (n <= ${MAX}): ${started}`,
    ).toBe(true);
  if (restarted) {
    // Same bounds the harness applies to a cell with a mechanism: the run may
    // re-issue the interrupted call, but the budget still caps it. Not exercised
    // is not a pass, hence the non-empty guard on the step list.
    expect(started.length, 'a step ran').toBeGreaterThan(0);
    noStepBeyondTheBudget();
    expect(probe.modelCalls, `at most ${MAX + 1} model calls across both runs`).toBeLessThanOrEqual(MAX + 1);
    return;
  }
  // No restart: the mock is a pure function of the prompt, so the run is
  // deterministic — the script asks for steps 1..3 and the third model call gets
  // tool call 3, which spends the budget and ends the run. Pinning the exact
  // values (the harness' compared contract) catches an engine that stops early,
  // which a `<=` bound alone would let pass.
  expect(started, 'the script got steps 1..3').toEqual([1, 2, 3]);
  expect(probe.modelCalls, `made exactly ${MAX} model calls`).toBe(MAX);
  noStepBeyondTheBudget();
}

const gates: Gate[] = [];
const scenarios: { stop(): Promise<void> }[] = [];
afterEach(async () => {
  // Release graph 1's gates first: a parked step must not be stopped mid-flight.
  for (const gate of gates.splice(0)) gate.release();
  await Promise.all(scenarios.splice(0).map(s => s.stop()));
});

describe('T20 step budget across recovery', () => {
  for (const engine of ['plain', 'durable', 'evented'] as const) {
    for (const variant of ['default', 'ceiling'] as const) {
      it(`${engine} / ${variant}`, async () => {
        const runId = `t20-${engine}-${variant}`;
        const probe: Probe = { modelCalls: 0, started: [] };
        const scorer = { calls: 0 };
        const agent = buildAgent({ Agent, createTool }, { variant, probe });
        const runner =
          engine === 'plain'
            ? agent
            : engine === 'durable'
              ? createDurableAgent({ agent })
              : createEventedAgent({ agent });
        const mastra = new Mastra({ logger: false, storage: new InMemoryStore(), agents: { t20: runner as any } });
        try {
          const result: any = await (mastra.getAgent('t20') as any).stream(
            'Go.',
            streamOptions(runId, variant, scorer),
          );
          const types = await drain(result.fullStream);
          result.cleanup?.();
          evaluate({ variant, types, probe, scorerCalls: scorer.calls, restarted: false });
        } finally {
          await mastra.stopWorkers();
        }
      }, 30_000);
    }
  }

  for (const kind of ['durable', 'evented'] as const) {
    it(`${kind}-recover / default`, async () => {
      const runId = `t20-${kind}-recover`;
      const gate = createGate();
      gates.push(gate);
      const probes = new Map<number, Probe>();
      const scenario = createRestartScenario({
        kind,
        runId,
        build: ({ core, generation }) => {
          const probe: Probe = { modelCalls: 0, started: [] };
          probes.set(generation, probe);
          return buildAgent(core, { variant: 'default', probe, block: generation === 1 ? gate : undefined });
        },
      });
      scenarios.push(scenario);
      const original = await scenario.start(({ agent }) =>
        agent.stream('Go.', streamOptions(runId, 'default', { calls: 0 })),
      );
      // Graph 1 runs on past the checkpoint (its gate is released in afterEach);
      // its fate is not the subject, and this branch must not reject unhandled.
      const drained = original.driven
        .then((result: any) => drain(result.fullStream))
        .then(
          () => 'ended' as const,
          () => 'ended' as const,
        );
      const reached = await Promise.race([gate.reached.then(() => 'reached' as const), drained]);
      expect(reached, 'not exercised: run ended before step 2').toBe('reached');

      const checkpoint = await original.checkpoint();
      // Graph 1's work up to the cut-off; it keeps running once the gate is released.
      const before = structuredClone(probes.get(1)!);
      const recovered = await scenario.restart(checkpoint);
      expect(recovered.streamErrors).toEqual([]);
      expect(recovered.executionError).toBeUndefined();

      const after = probes.get(2)!;
      evaluate({
        variant: 'default',
        types: recovered.chunkTypes!,
        probe: { modelCalls: before.modelCalls + after.modelCalls, started: [...before.started, ...after.started] },
        scorerCalls: 0,
        restarted: true,
      });
    }, 30_000);
  }
});
