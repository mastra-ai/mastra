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
 * contracts across engines — the cross-engine divergence is COR-1430, declared below.
 *
 * COR-1430 (declared below, for durable and evented): a throwing `stopWhen` rejects plain's stream
 * — its turn simply ends after the tool result — where durable and evented append `step-finish` and
 * `error` chunks to that same turn and resolve. The declaration's `expect` adds exactly those chunks,
 * so the helper's leaf-by-leaf comparison still covers everything else, and its own staleness check
 * fails the moment either side stops behaving this way.
 *
 * Plain's own values are pinned literally, read from the observation the helper returns, so the
 * reference stays visible next to the declaration.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../../memory/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import type {
  EngineDifference,
  EngineObservation,
  ModelScript,
  ParityEngine,
  ParitySnapshot,
  ParityStreamOptions,
} from './parity-harness';
import { chunksOfType, expectEngineParity, textOnlyTape, toolCallTape } from './parity-harness';

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

/**
 * COR-1430: the same run settles differently. plain rejects the stream on the throwing predicate,
 * so its turn ends after the tool result; durable and evented append `step-finish` and `error` chunks
 * to that turn and resolve. The expectation adds exactly those chunks so the helper still compares
 * everything else leaf by leaf.
 *
 * `chunkPayloads` is ignored because the extra payloads are not derivable from plain's observation.
 * The test body pins the parts that matter instead — the extra chunks' types, the completed step,
 * and the error they carry.
 */
function settledAfterThrowingStopWhen(plain: EngineObservation): EngineObservation {
  return {
    ...plain,
    turns: plain.turns.map(turn => ({
      ...turn,
      chunks: [...turn.chunks, 'AGENT:step-finish', 'undefined:error'],
      chunkTypes: [...turn.chunkTypes, 'step-finish', 'error'],
    })),
  };
}

const COR_1430: EngineDifference = {
  reason:
    "COR-1430: a throwing stopWhen rejects plain's stream, where durable and evented stream `step-finish` and `error` chunks instead and resolve.",
  ignore: ['chunkPayloads'],
  expect: settledAfterThrowingStopWhen,
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

/** The messages of a turn's `error` chunks, read the way the harness reads them. */
function errorMessages(turn: ParitySnapshot): string[] {
  return turn.chunkTypes
    .map((type, index) => (type === 'error' ? (turn.chunkPayloads[index] as { error?: { message?: unknown } }) : null))
    .filter(payload => payload !== null)
    .map(payload => String(payload?.error?.message ?? ''));
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
    // `throws` settles differently on the wrapped engines (COR-1430).
    differences: variant === 'throws' ? { durable: COR_1430, evented: COR_1430 } : undefined,
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

      // Every engine must report that each step before the last continued and the step stopWhen
      // ended on did not. The channel layer uses this flag to close its render queue.
      for (const engine of ENGINES) {
        const flags = stepFinishStepResults(results[engine]!.turns.at(-1)!);
        expect(flags, `${engine}: step-finish results`).toHaveLength(expected);
        expect(
          flags.map(flag => flag.isContinued),
          `${engine}: every step before the last continued, the step stopWhen ended on did not`,
        ).toEqual([...Array<boolean>(expected - 1).fill(true), false]);
        expect(
          flags.map(flag => flag.reason),
          `${engine}: step-finish reasons`,
        ).toEqual(Array<unknown>(expected).fill('tool-calls'));
      }
    },
  );

  it('a throwing stopWhen settles the run one way or another', async () => {
    const { results, commits, calls } = await runT23('throws');

    // The harness records this contract per engine, reference-vs-candidate; its fields are asserted
    // below from the observation the helper returned.
    for (const engine of ENGINES) {
      const { turns, requests } = results[engine]!;
      const turn = turns.at(-1)!;

      // The throwing predicate has to be what settled the run, otherwise this leg is vacuous.
      expect(calls.get(engine)!.length, `${engine}: the throwing predicate was consulted`).toBeGreaterThanOrEqual(1);
      expect(requests, `${engine}: modelCalls`).toHaveLength(1);
      expect(commits.get(engine), `${engine}: commits`).toBe(1);
      expect(chunksOfType(turn, 'finish'), `${engine}: finish`).toBe(0);
      // No finish chunk reached the stream, so the harness's finishReason has nothing to read.
      expect(turn.finishChunk.payloadKeys, `${engine}: finishReason`).toEqual([]);
      expect(
        errorMessages(turn).length > 0 || turn.error !== undefined,
        `${engine}: throwing stopWhen settles the run one way or another`,
      ).toBe(true);
      expect(turn.error, `${engine}: threw`).toEqual({ name: 'Error', message: 'T23 stopWhen failure' });
      // The shared chunks' `chunkPayloads` is ignored for this behaviour (see COR_1430), so pin the
      // payload the harness's `commits` stands for.
      expect((turn.chunkPayloads[3] as { result?: unknown }).result, `${engine}: tool result`).toEqual({ done: 1 });
    }

    // Plain's reference, read off the observation the helper returned: the rejection ends the turn
    // after the tool result, so nothing else reaches the stream. Durable and evented settle the same
    // run by appending the completed step and error chunks the COR-1430 declaration adds — its
    // `expect` makes the comparison above possible, and its `reason` records why they may differ.
    const plainTypes = results.plain!.turns.at(-1)!.chunkTypes;
    expect(plainTypes).toEqual(['start', 'step-start', 'tool-call', 'tool-result']);
    expect(errorMessages(results.plain!.turns.at(-1)!), 'plain: no error chunk on the wire').toEqual([]);

    for (const engine of ['durable', 'evented'] as const) {
      const turn = results[engine]!.turns.at(-1)!;
      expect(turn.chunkTypes, `${engine}: chunks`).toEqual([
        'start',
        'step-start',
        'tool-call',
        'tool-result',
        'step-finish',
        'error',
      ]);
      expect((turn.chunkPayloads[4] as { stepResult?: { reason?: unknown } }).stepResult?.reason).toBe('tool-calls');
      expect(errorMessages(turn), `${engine}: error chunk`).toEqual(['T23 stopWhen failure']);
    }

    // How often the predicate is consulted differs across engines: plain and durable ask once,
    // while evented may ask more because its worker re-runs the step and re-reads the decision.
    expect(calls.get('plain')!.length, 'plain: the predicate was consulted once').toBe(1);
    expect(calls.get('durable')!.length, 'durable: the predicate was consulted once').toBe(1);
    expect(calls.get('evented')!.length, 'evented: the predicate was consulted').toBeGreaterThanOrEqual(1);
  });
});
