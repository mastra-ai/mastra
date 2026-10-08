/**
 * Ported from validation harness case T23 (stop-when).
 *
 * The script would call `step` four times. `stopWhen` must end the run earlier, and the step it
 * ends on must be the same on plain, durable and evented agents. The predicate runs whenever the
 * model wants to continue (there is no `maxSteps` gate here), so with `maxSteps: 10` the predicate
 * is the only thing stopping the run:
 *   predicate      one tool turn, one model call
 *   has-tool-call  the same outcome, hand-rolled from the last step's tool calls
 *   array          two tool turns (first predicate never fires)
 *   throws         a throwing predicate has to settle the run one way or another, never hang
 *
 * Deviation from the harness for the `throws` leg: the harness records its contract
 * reference-vs-candidate (main vs PR) and marks its engine comparison NOT COMPARABLE, because
 * plain fails "worker completion" while durable and evented pass. The port therefore asserts the
 * harness's actual per-engine check (`finish >= 1 || errors || threw`) and does not compare the
 * contracts across engines. The observed cross-engine divergence — plain rejects the stream,
 * durable/evented stream an `error` chunk, evented consults the predicate more than once — is
 * recorded as the F-5 finding rather than pinned.
 *
 * COR-1412 (declared below, for durable and evented): the durable loop emits `step-finish` before
 * the continuation decision is made, so on durable and evented the step a run stops on reports
 * `stepResult.isContinued: true` where plain reports `false` (finding F-1). That flag is what the
 * loop and the channel layer read to close a run — `channels/output-processor.ts:196` only closes a
 * render queue on a `step-finish` whose `isContinued !== true` — so a durable or evented run that
 * stops on a tool step leaves it open. The declaration derives the wrong value from plain's own
 * observation rather than ignoring the field, so these legs fail again the moment either side is
 * fixed (and the helper refuses a declaration that stops reproducing at all).
 *
 * plain's own values are pinned literally, read from the observation the helper returns, so the
 * reference stays visible next to the declaration. The `throws` leg stays directly driven: the
 * helper does record the rejected run now (`COR-1417` made a failed run an observation, and all
 * three engines report `Error: T23 stopWhen failure`), but the recorded divergence is not one any
 * ticket owns — durable and evented stream `step-finish` plus an `error` chunk where plain's
 * stream simply rejects, and evented consults the predicate three times — so driving it through
 * the helper would mean declaring a difference against no ticket. It is reported as the F-5
 * finding instead.
 */
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
import type {
  EngineDifference,
  EngineObservation,
  ModelScript,
  ParityEngine,
  ParitySnapshot,
  ParityStreamOptions,
} from './parity-harness';
import { chunksOfType, createRecordingModel, expectEngineParity, textOnlyTape, toolCallTape } from './parity-harness';

const ENGINES: ParityEngine[] = ['plain', 'durable', 'evented'];

/** `maxSteps` well above the script, so only `stopWhen` can end these runs. */
const MAX_STEPS = 10;

type Variant = 'predicate' | 'has-tool-call' | 'array' | 'throws';

/** The shape the loop hands a stop predicate. */
type StopContext = { steps: Array<{ toolCalls?: Array<{ toolName?: string }> }> };
type StopPredicate = (context: StopContext) => boolean;
type StopWhen = NonNullable<ParityStreamOptions['stopWhen']>;

/** Tool turns each variant is expected to complete; `throws` promises nothing. */
const EXPECTED_TURNS: Partial<Record<Variant, number>> = { predicate: 1, 'has-tool-call': 1, array: 2 };

/** The contract the harness compares across cells for the `throws` variant. */
type ThrowsContract = {
  modelCalls: number;
  commits: number;
  finish: number;
  finishReason: unknown;
  predicateCalls: Array<{ name: string; steps: number }>;
  errors: string[];
  threw: string | null;
};

/**
 * COR-1412: the durable loop emits `step-finish` before the continuation decision, so on durable
 * and evented the step the run stops on reports `stepResult.isContinued: true` where plain reports
 * `false` — the value `channels/output-processor.ts:196` reads to close a render queue. The
 * expectation derives the wrong value from plain's own observation, so it fails the moment either
 * side is fixed (and the helper's own "no longer reproduces" check fails if it stops differing).
 */
function terminatingStepStaysContinued(plain: EngineObservation): EngineObservation {
  return {
    ...plain,
    turns: plain.turns.map(turn => {
      const index = turn.chunkTypes.lastIndexOf('step-finish');
      if (index < 0) return turn;
      const payload = turn.chunkPayloads[index] as { stepResult?: Record<string, unknown> } | undefined;
      const chunkPayloads = [...turn.chunkPayloads];
      chunkPayloads[index] = { ...payload, stepResult: { ...payload?.stepResult, isContinued: true } };
      return { ...turn, chunkPayloads };
    }),
  };
}

const COR_1412: EngineDifference = {
  reason:
    'COR-1412: durable and evented emit the terminating step-finish before the continuation decision, so stepResult.isContinued stays true where plain reports false (channels/output-processor.ts:196 only closes a render queue on isContinued !== true).',
  expect: terminatingStepStaysContinued,
};

/** The `stepResult` of every `step-finish` chunk in a turn, in order. */
function stepFinishStepResults(turn: ParitySnapshot): Array<{ isContinued?: unknown; reason?: unknown }> {
  return turn.chunkTypes
    .map((type, index) =>
      type === 'step-finish' ? (turn.chunkPayloads[index] as { stepResult?: unknown }) : undefined,
    )
    .filter(payload => payload !== undefined)
    .map(payload => (payload?.stepResult ?? {}) as { isContinued?: unknown; reason?: unknown });
}

/** The script: keep calling `step` until four results are in the prompt. */
const script: ModelScript = {
  respond: request => {
    const done = toolResultCount(request);
    return done < 4
      ? toolCallTape('step', { n: done + 1 }, `call-${done + 1}`)
      : textOnlyTape(`finished ${done} steps`);
  },
};

/** Counts the tool results a request's prompt already carries, like the harness script. */
function toolResultCount(request: { prompt: Array<{ role: string; content: unknown }> }): number {
  let count = 0;
  for (const message of request.prompt) {
    if (message.role !== 'tool' || !Array.isArray(message.content)) continue;
    count += message.content.filter((part: { type?: string }) => part?.type === 'tool-result').length;
  }
  return count;
}

/**
 * Builds the variant's `stopWhen` plus a recorder for every predicate call, so the test can prove
 * the predicate was actually consulted rather than assumed.
 */
function stopWhenFor(variant: Variant, calls: Array<{ name: string; steps: number }>): StopWhen | undefined {
  const seen = (name: string) => (steps: StopContext['steps']) => {
    calls.push({ name, steps: steps.length });
  };
  switch (variant) {
    case 'predicate':
      return (({ steps }: StopContext) => (seen('predicate')(steps), steps.length >= 1)) as StopWhen;
    case 'has-tool-call':
      return (({ steps }: StopContext) => {
        seen('has-tool-call')(steps);
        return (steps.at(-1)?.toolCalls ?? []).some(toolCall => toolCall.toolName === 'step');
      }) as StopWhen;
    case 'array':
      return [
        (({ steps }: StopContext) => (seen('never')(steps), false)) as StopPredicate,
        (({ steps }: StopContext) => (seen('two')(steps), steps.length >= 2)) as StopPredicate,
      ] as StopWhen;
    case 'throws':
      return (({ steps }: StopContext) => {
        seen('throws')(steps);
        throw new Error('T23 stopWhen failure');
      }) as StopWhen;
  }
}

/**
 * A local `step` tool. `commit` is the harness's tool log entry: one execution per tool call the
 * model asked for.
 */
function createStepTool(onCommit: () => void) {
  return createTool({
    id: 'step',
    description: 'Advance one step.',
    inputSchema: z.object({ n: z.number() }),
    execute: async ({ n }) => {
      onCommit();
      return { done: n };
    },
  });
}

/** Runs one T23 variant across the three engines, recording commits and predicate calls per engine. */
async function runT23(variant: Variant) {
  const commits = new Map<ParityEngine, number>();
  const calls = new Map<ParityEngine, Array<{ name: string; steps: number }>>();

  const results = await expectEngineParity({
    model: script,
    differences: { durable: COR_1412, evented: COR_1412 },
    buildAgent: ({ engine, model }) => {
      commits.set(engine, 0);
      calls.set(engine, []);
      return new Agent({
        id: 't23-agent',
        name: 't23',
        instructions: 'Follow the script.',
        model,
        tools: { step: createStepTool(() => commits.set(engine, commits.get(engine)! + 1)) },
        memory: new MockMemory(),
      });
    },
    run: async handle => {
      // Built per engine so each predicate records only its own engine's steps.
      const engineCalls = calls.get(handle.engine)!;
      const options: ParityStreamOptions = {
        maxSteps: MAX_STEPS,
        memory: { thread: `t23-thread-${variant}`, resource: 't23-resource' },
        stopWhen: stopWhenFor(variant, engineCalls),
      };
      await handle.turn('Go.', options);
    },
  });

  return { results, commits, calls };
}

describe('T23 stopWhen (plain, durable, evented)', () => {
  it.each<Variant>(['predicate', 'has-tool-call', 'array'])(
    '%s ends the run on the same step on every engine',
    async variant => {
      const { results, commits, calls } = await runT23(variant);
      const expected = EXPECTED_TURNS[variant]!;

      for (const engine of ENGINES) {
        const { turns, requests } = results[engine]!;

        expect(commits.get(engine)).toBe(expected);
        expect(requests).toHaveLength(expected);
        expect(chunksOfType(turns.at(-1)!, 'finish')).toBe(1);
        expect(chunksOfType(turns.at(-1)!, 'error')).toBe(0);
        expect(calls.get(engine)!.length).toBeGreaterThanOrEqual(1);
      }

      // plain's reference values, read off the observation the helper returned. plain stamps the
      // terminating `step-finish` with `isContinued: false`, which is what the loop and the channel
      // layer read to close the run (`channels/output-processor.ts:196` only closes on a `step-finish`
      // whose `isContinued !== true`). durable and evented report the opposite value — COR-1412,
      // declared above — so these literals are the reference that declaration is measured against.
      const plainFlags = stepFinishStepResults(results.plain!.turns.at(-1)!);
      expect(plainFlags).toHaveLength(expected);
      expect(
        plainFlags.map(flag => flag.isContinued),
        'plain: every step before the last continued, the step stopWhen ended on did not',
      ).toEqual([...Array<boolean>(expected - 1).fill(true), false]);
      expect(plainFlags.map(flag => flag.reason)).toEqual(Array<unknown>(expected).fill('tool-calls'));
    },
  );

  it('a throwing stopWhen settles the run one way or another', async () => {
    const contracts = new Map<ParityEngine, ThrowsContract>();

    for (const engine of ENGINES) {
      const recorded = createRecordingModel(script);
      const calls: Array<{ name: string; steps: number }> = [];
      let commits = 0;
      const pubsub = new EventEmitterPubSub();
      const base = new Agent({
        id: `t23-agent-${engine}`,
        name: 't23',
        instructions: 'Follow the script.',
        model: recorded.model,
        tools: { step: createStepTool(() => (commits += 1)) },
        memory: new MockMemory(),
      });
      const wrapper =
        engine === 'durable'
          ? createDurableAgent({ agent: base, pubsub })
          : engine === 'evented'
            ? createEventedAgent({ agent: base, pubsub })
            : undefined;
      const host = new Mastra({
        agents: { [base.id]: (wrapper ?? base) as Agent },
        storage: new InMemoryStore(),
        logger: false,
      });

      const errors: string[] = [];
      const finishPayloads: Array<Record<string, unknown>> = [];
      let threw: string | null = null;
      try {
        const streamed = await (wrapper ?? base).stream('Go.', {
          maxSteps: MAX_STEPS,
          memory: { thread: `t23-thread-throws-${engine}`, resource: 't23-resource' },
          stopWhen: stopWhenFor('throws', calls),
        } as never);
        const output =
          (streamed as { output?: { fullStream: AsyncIterable<{ type?: string; payload?: any }> } }).output ?? streamed;
        for await (const chunk of output.fullStream as AsyncIterable<{ type?: string; payload?: any }>) {
          if (chunk.type === 'finish') finishPayloads.push(chunk.payload ?? {});
          if (chunk.type === 'error') errors.push(String(chunk.payload?.error?.message ?? ''));
        }
      } catch (error) {
        // The harness slices a thrown message to 200 characters.
        threw = String((error as Error)?.message ?? error).slice(0, 200);
      } finally {
        await host.shutdown();
        await pubsub.close();
      }

      const lastFinish = finishPayloads.at(-1);
      contracts.set(engine, {
        modelCalls: recorded.requests.length,
        commits,
        finish: finishPayloads.length,
        finishReason:
          (lastFinish?.stepResult as { reason?: unknown } | undefined)?.reason ?? lastFinish?.finishReason ?? null,
        predicateCalls: calls,
        errors,
        threw,
      });
    }

    // The harness records this contract reference-vs-candidate build (a regression check), NOT
    // across engines: its `throws` cells are NOT COMPARABLE, because plain fails "worker
    // completion" while durable and evented pass. So the port asserts the harness's actual
    // per-engine check — the run settled, one way or another — and deliberately does not compare
    // the contracts across engines.
    //
    // Observed divergence (harness-acknowledged by the NOT COMPARABLE verdict, not asserted here):
    // plain rejects the stream (`threw`); durable and evented stream an `error` chunk instead,
    // and evented consults the predicate more than once. These are the F-5 finding reported for
    // the T23 leg — see the file header.
    for (const engine of ENGINES) {
      const contract = contracts.get(engine)!;
      // The throwing predicate has to be what settled the run, otherwise this leg is vacuous.
      expect(contract.predicateCalls.length, `${engine}: the throwing predicate was consulted`).toBeGreaterThanOrEqual(
        1,
      );
      expect(
        contract.finish >= 1 || contract.errors.length > 0 || contract.threw !== null,
        `${engine}: throwing stopWhen settles the run one way or another (${JSON.stringify(contract)})`,
      ).toBe(true);
    }
  });
});
