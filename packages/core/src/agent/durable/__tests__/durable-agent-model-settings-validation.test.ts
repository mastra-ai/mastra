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
 * than as `turn()` throwing, so it is compared like any other turn. Every engine
 * must preserve the validation `TypeError` and reject with the same message.
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

    const results = await expectEngineParity(scenario);

    for (const engine of ENGINES) {
      const turn = results[engine]!.turns[0]!;

      // 'invalid timeout rejected (throw or error chunk)': the run produced no
      // chunks at all, and the failure carries the settings-validation message.
      expect(turn.chunks, `${engine}: no chunks before the rejection`).toEqual([]);
      expect(turn.error?.message, `${engine}: rejection message`).toMatch(TIMEOUT_ERROR);
      expect(turn.error).toStrictEqual({
        name: 'TypeError',
        message: results.plain!.turns[0]!.error?.message,
      });
      // 'model never called with the invalid settings'
      expect(results[engine]!.requests, `${engine}: model calls`).toHaveLength(0);
    }
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
