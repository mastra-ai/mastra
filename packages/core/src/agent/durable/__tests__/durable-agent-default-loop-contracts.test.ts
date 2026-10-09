/**
 * Ported from validation harness case T18 (default-loop-contracts).
 *
 * The default agentic loop's iteration-complete contract must hold on every
 * engine: `onIterationComplete` can stop the run (`{ continue: false }`), ask
 * for one more iteration with feedback, or throw, and a tool whose
 * `toModelOutput` throws must still leave the run settled.
 *
 * Only the cross-engine part of the harness case is ported. The harness's plain
 * cell also compares the reference build against the candidate build; here the
 * helper runs the same scenario against plain, durable and evented, so the
 * variants below assert the contract across those three engines.
 *
 * `iter-stop` and `iter-feedback` are ordinary runs, so they go through
 * `expectEngineParity`, which compares the whole snapshot on every engine.
 * `iter-throws` and `mapper-throws` promise no outcome beyond "the run settles
 * one way or another"; because a thrown hook rejects the run on plain — which
 * the helper reports as a scenario failure with no per-engine results — those
 * two are driven per engine and asserted the way the harness judges them: the
 * settle check per engine, then the harness's own cross-engine comparison of
 * the whole contract. Each installs only its own failure, as the harness does:
 * `iter-throws` throws from `onIterationComplete` and has no throwing mapper,
 * `mapper-throws` throws from `toModelOutput` and installs no hook.
 *
 * The `iter-feedback` leg carries no declarations: plain resolves the previous
 * iteration's text exactly once (COR-1416) and the wrapped engines report the
 * continuation flag for the iteration that asked for it, so all three engines
 * agree on the whole snapshot. Plain's values are pinned literally, read from
 * the observation the helper returns. The two throwing legs are the only ones
 * driven directly: a rejected run leaves the helper nothing to record.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import type { IterationCompleteContext, IterationCompleteResult } from '../../agent.types';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';
import {
  chunksOfType,
  createRecordingModel,
  expectEngineParity,
  textOnlyTape,
  toolCallTape,
  type CapturedRequest,
  type ModelScript,
  type ParityEngine,
  type ParitySnapshot,
  type ParityStreamOptions,
} from './parity-harness';

const ENGINES: ParityEngine[] = ['plain', 'durable', 'evented'];
const FEEDBACK = 'Now say MORE.';
const MAX_STEPS = 5;

type OrdinaryVariant = 'iter-stop' | 'iter-feedback';
type ThrowingVariant = 'iter-throws' | 'mapper-throws';
type HookCall = { iteration: number; isFinal: boolean; text: string };

/** Tool results the model has already seen, mirroring the harness's `toolResults(prompt)`. */
function toolResultCount(request: CapturedRequest): number {
  let count = 0;
  for (const message of request.prompt) {
    if (message.role !== 'tool' || typeof message.content === 'string') continue;
    for (const part of message.content) {
      if (part.type === 'tool-result') count += 1;
    }
  }
  return count;
}

/** Calls `step` for n = 1..count, one per model turn, then answers with every result. */
function stepScript(count: number): ModelScript {
  return {
    respond: request => {
      const done = toolResultCount(request);
      return done < count
        ? toolCallTape('step', { n: done + 1 }, `call-${done + 1}`)
        : textOnlyTape(`finished ${done} steps`);
    },
  };
}

/** Answers as a function of whether the feedback message has already reached the request. */
function feedbackScript(): ModelScript {
  return {
    respond: request => textOnlyTape(JSON.stringify(request).includes(FEEDBACK) ? 'MORE' : 'first'),
  };
}

function stepTool(onCommit: () => void) {
  return createTool({
    id: 'step',
    description: 'Perform numbered step n. Slow.',
    inputSchema: z.object({ n: z.number() }),
    execute: async ({ n }) => {
      onCommit();
      return { done: n };
    },
  });
}

/** A `step` tool whose model-facing output throws, as in the harness's `mapper-throws`. */
function throwingMapperStepTool(onCommit: () => void) {
  return createTool({
    id: 'step',
    description: 'Perform numbered step n. Slow.',
    inputSchema: z.object({ n: z.number() }),
    execute: async ({ n }) => {
      onCommit();
      return { done: n };
    },
    toModelOutput: () => {
      throw new Error('T18 mapper failure');
    },
  });
}

/** Stops after iteration 1, or throws when the variant promises no decision. */
function stopHook(calls: HookCall[]) {
  return (context: IterationCompleteContext): IterationCompleteResult | void => {
    calls.push({ iteration: context.iteration, isFinal: context.isFinal, text: context.text });
    return context.iteration === 1 ? { continue: false } : undefined;
  };
}

/** Asks for one more iteration with feedback, exactly once. */
function feedbackHook(calls: HookCall[]) {
  return (context: IterationCompleteContext): IterationCompleteResult | void => {
    calls.push({ iteration: context.iteration, isFinal: context.isFinal, text: context.text });
    return context.iteration === 1 ? { continue: true, feedback: FEEDBACK } : undefined;
  };
}

/** Throws on every call, which is the whole point of the `iter-throws` variant. */
function throwingHook(calls: HookCall[]) {
  return (context: IterationCompleteContext): IterationCompleteResult | void => {
    calls.push({ iteration: context.iteration, isFinal: context.isFinal, text: context.text });
    throw new Error('T18 hook failure');
  };
}

/** The `stepResult` of every `step-finish` chunk in a turn, in order. */
function stepFinishStepResults(turn: ParitySnapshot): Array<{ isContinued?: unknown; reason?: unknown }> {
  return turn.chunkTypes
    .map((type, index) =>
      type === 'step-finish' ? (turn.chunkPayloads[index] as { stepResult?: unknown }) : undefined,
    )
    .filter(payload => payload !== undefined)
    .map(payload => (payload?.stepResult ?? {}) as { isContinued?: unknown; reason?: unknown });
}

async function runOrdinaryVariant(variant: OrdinaryVariant) {
  const commits = new Map<ParityEngine, number>();
  const hookCalls = new Map<ParityEngine, HookCall[]>();
  for (const engine of ENGINES) {
    commits.set(engine, 0);
    hookCalls.set(engine, []);
  }

  const results = await expectEngineParity({
    engines: ENGINES,
    model: variant === 'iter-feedback' ? feedbackScript() : stepScript(3),
    buildAgent: ({ engine, model }) => {
      const onCommit = () => commits.set(engine, commits.get(engine)! + 1);
      return new Agent({
        id: 't18-agent',
        name: 't18',
        instructions: 'Follow the script.',
        model,
        memory: new MockMemory(),
        ...(variant === 'iter-feedback' ? {} : { tools: { step: stepTool(onCommit) } }),
      });
    },
    run: async handle => {
      const options: ParityStreamOptions = {
        maxSteps: MAX_STEPS,
        memory: { thread: `t18-thread-${variant}`, resource: `t18-resource-${variant}` },
        onIterationComplete:
          variant === 'iter-feedback'
            ? feedbackHook(hookCalls.get(handle.engine)!)
            : stopHook(hookCalls.get(handle.engine)!),
      };
      await handle.turn('Go.', options);
    },
  });

  return { results, commits, hookCalls };
}

/**
 * Drives one engine directly so a rejected run is recorded instead of thrown out
 * of the helper, and builds the same contract the harness compares across cells.
 * Only the variant's own failure is installed, so the two throwing legs stay
 * isolated from each other.
 */
async function runThrowingVariantOnEngine(variant: ThrowingVariant, engine: ParityEngine) {
  const recorded = createRecordingModel(variant === 'mapper-throws' ? stepScript(1) : stepScript(3));
  const hookCalls: HookCall[] = [];
  let commits = 0;
  const onCommit = () => {
    commits += 1;
  };
  const agent = new Agent({
    id: `t18-agent-${variant}-${engine}`,
    name: 't18',
    instructions: 'Follow the script.',
    model: recorded.model,
    memory: new MockMemory(),
    tools: {
      step: variant === 'mapper-throws' ? throwingMapperStepTool(onCommit) : stepTool(onCommit),
    },
  });

  const pubsub = new EventEmitterPubSub();
  const wrapper =
    engine === 'durable'
      ? createDurableAgent({ agent, pubsub })
      : engine === 'evented'
        ? createEventedAgent({ agent, pubsub })
        : undefined;
  const host = new Mastra({
    agents: { [agent.id]: wrapper ?? agent },
    storage: new InMemoryStore(),
    logger: false,
  });

  const chunks: Array<{ type: string; message: string }> = [];
  let threw: string | null = null;
  let finalText = '';
  try {
    const runner: { stream: (input: string, options: Record<string, unknown>) => Promise<unknown> } = wrapper ?? agent;
    const streamOptions: Record<string, unknown> = {
      maxSteps: MAX_STEPS,
      runId: `t18-run-${variant}-${engine}`,
      memory: { thread: `t18-thread-${variant}`, resource: `t18-resource-${variant}` },
      // The harness gives `mapper-throws` only a throwing `toModelOutput` — no iteration hook is
      // installed — so that run can settle from the mapper instead of from a hook failure.
      ...(variant === 'iter-throws' ? { onIterationComplete: throwingHook(hookCalls) } : {}),
    };
    const result = (await runner.stream('Go.', streamOptions)) as {
      output?: { fullStream: AsyncIterable<any> };
      cleanup?: () => void;
    };
    const output = (result.output ?? result) as { fullStream: AsyncIterable<any> };
    for await (const chunk of output.fullStream) {
      if (chunk.type === 'text-delta') finalText += String(chunk.payload?.text ?? '');
      chunks.push({
        type: chunk.type,
        message: String(chunk.payload?.error?.message ?? '').slice(0, 120),
      });
    }
    result.cleanup?.();
  } catch (error) {
    threw = String((error as { message?: string })?.message ?? error).slice(0, 200);
  } finally {
    await host.shutdown();
    await pubsub.close();
  }

  return {
    finish: chunks.filter(chunk => chunk.type === 'finish').length,
    errors: chunks.filter(chunk => chunk.type === 'error').map(chunk => chunk.message),
    threw,
    commits,
    modelCalls: recorded.requests.length,
    finalText,
    hookCalls: hookCalls.length,
  };
}

function expectTurnSettled(turn: ParitySnapshot) {
  expect(chunksOfType(turn, 'finish')).toBe(1);
  expect(chunksOfType(turn, 'error')).toBe(0);
}

describe('T18 default loop contracts (plain, durable, evented)', () => {
  it('iter-stop: continue:false stops after iteration 1 on every engine', async () => {
    const { results, commits, hookCalls } = await runOrdinaryVariant('iter-stop');
    for (const engine of ENGINES) {
      const turn = results[engine]!.turns.at(-1)!;
      expectTurnSettled(turn);
      // Harness check: 'continue:false stops after iteration 1' (`commits === 1 && modelCalls === 1`).
      expect(commits.get(engine), `${engine}: stopWhen-ended run committed the step`).toBe(1);
      expect(results[engine]!.requests).toHaveLength(1);
      // Plain's reference values, pinned literally: the single model turn answered with a tool
      // call, so it streamed no text, and the hook was consulted once (iteration 1).
      expect(turn.streamedText).toBe('');
      expect(hookCalls.get(engine), `${engine}: the iteration hook was consulted once`).toHaveLength(1);
      expect(stepFinishStepResults(turn), `${engine}: the stopping step did not continue`).toEqual([
        { isContinued: false, reason: 'tool-calls' },
      ]);
    }

    // Plain's remaining reference values, read off the observation the helper returned.
    const plainTurn = results.plain!.turns.at(-1)!;
    expect(commits.get('plain')).toBe(1);
    expect(hookCalls.get('plain')).toEqual([{ iteration: 1, isFinal: false, text: '' }]);
    expect(plainTurn.fullOutput.text).toBe('');
    expect(plainTurn.chunkTypes).toEqual(['start', 'step-start', 'tool-call', 'tool-result', 'step-finish', 'finish']);
  });

  it('iter-feedback: feedback triggers one more iteration that sees it on every engine', async () => {
    const { results, hookCalls } = await runOrdinaryVariant('iter-feedback');
    for (const engine of ENGINES) {
      const turn = results[engine]!.turns.at(-1)!;
      expectTurnSettled(turn);
      expect(results[engine]!.requests).toHaveLength(2);
      expect(turn.streamedText).toMatch(/MORE$/);
      // Harness check: 'feedback triggers one more iteration that sees it' (`modelCalls === 2 &&
      // /MORE$/.test(finalText)`); the two requests and the streamed text above are that check.
      // The feedback itself is the hook's return value, and `context.text` carries the iteration's
      // own text rather than the feedback message, so the second call reads `MORE`.
      expect(hookCalls.get(engine), `${engine}: the iteration hook was consulted twice`).toHaveLength(2);
      expect(hookCalls.get(engine)?.[1]?.text, `${engine}: the hook saw the second iteration's text`).toBe('MORE');
      expect(stepFinishStepResults(turn), `${engine}: feedback continued only the first iteration`).toEqual([
        { isContinued: true, reason: 'stop' },
        { isContinued: false, reason: 'stop' },
      ]);
    }

    // Plain's resolved full output carries the response exactly once, matching the stream.
    const plainTurn = results.plain!.turns.at(-1)!;
    expect(hookCalls.get('plain')).toEqual([
      { iteration: 1, isFinal: true, text: 'first' },
      { iteration: 2, isFinal: true, text: 'MORE' },
    ]);
    expect(plainTurn.streamedText).toBe('firstMORE');
    expect(plainTurn.fullOutput.text).toBe('firstMORE');
    expect(plainTurn.chunkTypes).toEqual([
      'start',
      'step-start',
      'text-start',
      'text-delta',
      'text-end',
      'step-finish',
      'step-start',
      'text-start',
      'text-delta',
      'text-end',
      'step-finish',
      'finish',
    ]);
  });

  it('iter-throws: a throwing onIterationComplete settles the run one way or another on every engine', async () => {
    const plain = await runThrowingVariantOnEngine('iter-throws', 'plain');
    expect(plain.finish === 1 || plain.errors.length > 0 || plain.threw !== null).toBe(true);
    for (const engine of [...ENGINES].filter(e => e !== 'plain')) {
      const other = await runThrowingVariantOnEngine('iter-throws', engine);
      expect(other.finish === 1 || other.errors.length > 0 || other.threw !== null).toBe(true);
      expect(other).toEqual(plain);
    }
  });

  it('mapper-throws: a throwing toModelOutput settles the run one way or another on every engine', async () => {
    const plain = await runThrowingVariantOnEngine('mapper-throws', 'plain');
    expect(plain.finish === 1 || plain.errors.length > 0 || plain.threw !== null).toBe(true);
    for (const engine of [...ENGINES].filter(e => e !== 'plain')) {
      const other = await runThrowingVariantOnEngine('mapper-throws', engine);
      expect(other.finish === 1 || other.errors.length > 0 || other.threw !== null).toBe(true);
      expect(other).toEqual(plain);
    }
  });
});
