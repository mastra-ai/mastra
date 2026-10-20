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
 *   throws         one tool turn, then the predicate rejects the stream
 */
import { expect, it } from 'vitest';
import { z } from 'zod';
import { Agent } from '../../../../agent';
import { MockMemory } from '../../../../memory/mock';
import { createTool } from '../../../../tools';
import type { ModelScript, ParityEngine, ParitySnapshot, ParityStreamOptions, ParityTarget } from '../parity';
import { chunksOfType, describeParity, expectParity, textOnlyTape, toolCallTape, toolResultCount } from '../parity';

/** `maxSteps` well above the script, so only `stopWhen` can end these runs. */
const MAX_STEPS = 10;

type Variant = 'predicate' | 'has-tool-call' | 'array' | 'throws';

/** The shape the loop hands a stop predicate. */
type StopContext = { steps: Array<{ toolCalls?: Array<{ toolName?: string }> }> };
type StopPredicate = (context: StopContext) => boolean;
type StopWhen = NonNullable<ParityStreamOptions['stopWhen']>;

/** Tool turns each non-throwing variant is expected to complete. */
const EXPECTED_TURNS: Partial<Record<Variant, number>> = { predicate: 1, 'has-tool-call': 1, array: 2 };

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

/** Runs one T23 variant on plain and the parity target, recording commits and predicate calls per engine. */
async function runT23(target: ParityTarget, variant: Variant) {
  const commits = new Map<ParityEngine, number>();
  const calls = new Map<ParityEngine, Array<{ name: string; steps: number }>>();

  const results = await expectParity(target, {
    model: script,
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

describeParity('stop-when parity', target => {
  const ENGINES = ['plain', target] as const;

  it.each<Variant>(['predicate', 'has-tool-call', 'array'])(
    '%s ends the run on the same step on every engine',
    async variant => {
      const { results, commits, calls } = await runT23(target, variant);
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

  it('a throwing stopWhen rejects the stream identically on every engine', async () => {
    const { results, commits, calls } = await runT23(target, 'throws');

    for (const engine of ENGINES) {
      const { turns, requests } = results[engine]!;
      const turn = turns.at(-1)!;

      expect(calls.get(engine)!.length, `${engine}: the throwing predicate was consulted`).toBeGreaterThanOrEqual(1);
      expect(requests, `${engine}: modelCalls`).toHaveLength(1);
      expect(commits.get(engine), `${engine}: commits`).toBe(1);
      expect(turn.chunkTypes, `${engine}: chunks`).toEqual(['start', 'step-start', 'tool-call', 'tool-result']);
      expect(chunksOfType(turn, 'finish'), `${engine}: finish`).toBe(0);
      expect(errorMessages(turn), `${engine}: no error chunk on the wire`).toEqual([]);
      expect(turn.finishChunk.payloadKeys, `${engine}: finishReason`).toEqual([]);
      expect(turn.error, `${engine}: threw`).toEqual({ name: 'Error', message: 'T23 stopWhen failure' });
      expect((turn.chunkPayloads[3] as { result?: unknown }).result, `${engine}: tool result`).toEqual({ done: 1 });
    }

    expect(calls.get('plain')!.length, 'plain: the predicate was consulted once').toBe(1);
    if (target === 'durable') {
      expect(calls.get('durable')!.length, 'durable: the predicate was consulted once').toBe(1);
    } else {
      // COR-1466: evented retries a throwing loop condition up to its delivery-attempt limit.
      expect(calls.get('evented')!.length, 'evented: the predicate was consulted three times').toBe(3);
    }
  });
});
