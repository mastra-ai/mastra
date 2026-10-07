/**
 * Ported from validation harness case T17 (model-settings-validation).
 *
 * An invalid `modelSettings.timeout` must be rejected before the model is ever
 * called, on every engine — durable and evented must not silently run without
 * the timeout the caller asked for. `valid` is the control: a sane timeout
 * changes nothing, the run completes normally with a single model call.
 *
 * The rejection happens before the plain engine streams anything, so the
 * harness's invalid variant has no stream to compare and cannot run through
 * `expectEngineParity` (the helper requires at least one plain turn). It is
 * therefore asserted per engine by driving `stream()` directly, exactly as the
 * harness does, while the valid variant goes through the parity helper.
 */
import { describe, expect, it } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';
import type { ParityEngine } from './parity-harness';
import { chunksOfType, createRecordingModel, expectEngineParity, textOnlyTape } from './parity-harness';

const ENGINES: ParityEngine[] = ['plain', 'durable', 'evented'];

/** The harness's rejected body: a negative per-step budget. */
const INVALID_TIMEOUT = { stepMs: -1 };
/** The harness's accepted control body. */
const VALID_TIMEOUT = { totalMs: 60_000, stepMs: 30_000 };

/** Matches the harness check `/modelSettings\.timeout/` on either surface. */
const TIMEOUT_ERROR = /modelSettings\.timeout/;

interface StreamChunkLike {
  type?: string;
  payload?: { error?: { message?: string } };
}

/**
 * Drives the invalid variant on one engine. Reproduces the helper's host setup
 * (the evented agent only runs when registered with storage) but keeps the
 * assertions outside the parity comparison, because plain produces no turn.
 */
async function runInvalidOnEngine(engine: ParityEngine) {
  const recorded = createRecordingModel({ respond: () => textOnlyTape('ok') });
  const base = new Agent({
    id: `t17-agent-${engine}`,
    name: 't17',
    instructions: 'Follow the script.',
    model: recorded.model,
    memory: new MockMemory(),
  });

  const pubsub = new EventEmitterPubSub();
  const wrapper =
    engine === 'durable'
      ? createDurableAgent({ agent: base, pubsub })
      : engine === 'evented'
        ? createEventedAgent({ agent: base, pubsub })
        : undefined;
  const host = new Mastra({ agents: { [base.id]: wrapper ?? base }, storage: new InMemoryStore(), logger: false });

  const runner = (wrapper ?? base) as unknown as {
    stream: (input: string, options: Record<string, unknown>) => Promise<unknown>;
  };

  let thrown: string | undefined;
  const errorMessages: string[] = [];
  try {
    const result = await runner.stream('Go.', {
      maxSteps: 2,
      memory: { thread: `t17-thread-${engine}`, resource: 't17-resource' },
      modelSettings: { timeout: INVALID_TIMEOUT },
    });
    const output = (
      wrapper && result && typeof result === 'object' && 'output' in result
        ? (result as { output: unknown }).output
        : result
    ) as AsyncIterable<StreamChunkLike>;
    for await (const chunk of output) {
      if (chunk?.type === 'error') errorMessages.push(String(chunk.payload?.error?.message ?? ''));
    }
  } catch (error) {
    thrown = String((error as Error)?.message ?? error);
  } finally {
    await host.shutdown();
    await pubsub.close();
  }

  return { thrown, errorMessages, modelCalls: recorded.requests.length };
}

describe('T17 modelSettings.timeout validation (plain, durable, evented)', () => {
  it.each(ENGINES)('%s: rejects an invalid timeout before calling the model', async engine => {
    const { thrown, errorMessages, modelCalls } = await runInvalidOnEngine(engine);

    // 'invalid timeout rejected (throw or error chunk)'
    expect(thrown ?? errorMessages.join(' ')).toMatch(TIMEOUT_ERROR);
    // 'model never called with the invalid settings'
    expect(modelCalls).toBe(0);
  });

  it('valid timeout: the run completes normally on every engine', async () => {
    const results = await expectEngineParity({
      model: { respond: () => textOnlyTape('ok') },
      buildAgent: ({ model }) =>
        new Agent({
          id: 't17-agent',
          name: 't17',
          instructions: 'Follow the script.',
          model,
          memory: new MockMemory(),
        }),
      run: async handle => {
        await handle.turn('Go.', {
          maxSteps: 2,
          memory: { thread: 't17-thread', resource: 't17-resource' },
          modelSettings: { timeout: VALID_TIMEOUT },
        });
      },
    });

    for (const engine of ENGINES) {
      const turn = results[engine]!.turns.at(-1);
      expect(chunksOfType(turn!, 'finish')).toBe(1);
      expect(chunksOfType(turn!, 'error')).toBe(0);
      expect(results[engine]!.requests).toHaveLength(1);
      expect(turn!.streamedText).toBe('ok');
    }

    // The harness's contract includes the chunk-type sequence (`types: list.map(c => c.type)`),
    // so pin it literally: cross-engine equality alone would pass even if all three engines
    // drifted together.
    expect(results.plain!.turns.at(-1)!.chunkTypes).toEqual([
      'start',
      'step-start',
      'text-start',
      'text-delta',
      'text-end',
      'step-finish',
      'finish',
    ]);
  });
});
