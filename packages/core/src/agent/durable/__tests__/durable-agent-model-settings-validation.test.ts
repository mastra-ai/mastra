/**
 * Ported from validation harness case T17 (model-settings-validation).
 *
 * An invalid `modelSettings.timeout` must be rejected before the model is ever
 * called, on every engine — durable and evented must not silently run without
 * the timeout the caller asked for. `valid` is the control: a sane timeout
 * changes nothing, the run completes normally with a single model call.
 *
 * Both variants drive `expectEngineParity`. The invalid variant rejects before
 * streaming, which the helper records as a failed run (`snapshot.error`) rather
 * than as `turn()` throwing, so it is compared like any other turn. The one
 * difference left is the failure's class: plain rejects with the plain `Error`
 * the argument validation raises, durable and evented with a `TypeError` for the
 * same input and message. That is COR-1419, declared per engine and pinned
 * below; the negative check at the end proves the declaration is still needed.
 */
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { describe, expect, it } from 'vitest';
import { MockMemory } from '../../../memory/mock';
import { Agent } from '../../agent';
import type { EngineParityScenario, ParityEngine } from './parity-harness';
import { chunksOfType, expectEngineParity, textOnlyTape } from './parity-harness';

const ENGINES: ParityEngine[] = ['plain', 'durable', 'evented'];

/** The harness's rejected body: a negative per-step budget. */
const INVALID_TIMEOUT = { stepMs: -1 };
/** The harness's accepted control body. */
const VALID_TIMEOUT = { totalMs: 60_000, stepMs: 30_000 };

/** Matches the harness check `/modelSettings\.timeout/` on either surface. */
const TIMEOUT_ERROR = /modelSettings\.timeout/;

const COR_1419_REASON =
  'COR-1419: pre-stream rejection, same message, but plain reports `Error` where the wrapped engines report `TypeError`';

function t17Agent({ model }: { model: LanguageModelV2 }) {
  return new Agent({
    id: 't17-agent',
    name: 't17',
    instructions: 'Follow the script.',
    model,
    memory: new MockMemory(),
  });
}

const MEMORY = { thread: 't17-thread', resource: 't17-resource' };

describe('T17 modelSettings.timeout validation (plain, durable, evented)', () => {
  it('rejects an invalid timeout before calling the model on every engine', async () => {
    const scenario: EngineParityScenario = {
      model: { respond: () => textOnlyTape('ok') },
      buildAgent: t17Agent,
      run: async handle => {
        await handle.turn('Go.', { maxSteps: 2, memory: MEMORY, modelSettings: { timeout: INVALID_TIMEOUT } });
      },
    };

    const results = await expectEngineParity({
      ...scenario,
      differences: {
        durable: { reason: COR_1419_REASON, ignore: ['error'] },
        evented: { reason: COR_1419_REASON, ignore: ['error'] },
      },
    });

    for (const engine of ENGINES) {
      const turn = results[engine]!.turns[0]!;

      // 'invalid timeout rejected (throw or error chunk)': the run produced no
      // chunks at all, and the failure carries the settings-validation message.
      expect(turn.chunks, `${engine}: no chunks before the rejection`).toEqual([]);
      expect(turn.error?.message, `${engine}: rejection message`).toMatch(TIMEOUT_ERROR);
      // Same message on every engine; only the class differs. Asserted per
      // engine so the declaration above cannot hide a drifting message or class.
      expect(turn.error).toStrictEqual({
        name: engine === 'plain' ? 'Error' : 'TypeError',
        message: results.plain!.turns[0]!.error?.message,
      });
      // 'model never called with the invalid settings'
      expect(results[engine]!.requests, `${engine}: model calls`).toHaveLength(0);
    }

    // The declaration is load-bearing: without it the differing class fails the
    // comparison. (The helper's own self-test covers the same contract.)
    await expect(expectEngineParity(scenario)).rejects.toThrow(/durable differs from plain at turns\[0\]\.error\.name/);
  });

  it('valid timeout: the run completes normally on every engine', async () => {
    const results = await expectEngineParity({
      model: { respond: () => textOnlyTape('ok') },
      buildAgent: t17Agent,
      run: async handle => {
        await handle.turn('Go.', { maxSteps: 2, memory: MEMORY, modelSettings: { timeout: VALID_TIMEOUT } });
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
