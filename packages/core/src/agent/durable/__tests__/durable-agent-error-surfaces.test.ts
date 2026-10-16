/**
 * Ported from validation harness case T37 (error-surfaces), green variants only.
 *
 * The harness case has three variants; two are green on main:
 *   - model-4xx: the model fails before producing any output (an up-front,
 *     non-retryable provider error).
 *   - stream-cut: the model streams one text delta, then the stream errors.
 *
 * The third variant, `tool-timeout` (a tool that never returns, with
 * `modelSettings.timeout.totalMs`), is red on main and moves with COR-1376. It is
 * not ported here.
 *
 * Harness exclusions: error message wording, and retry timing (T27).
 *
 * `stream-cut` runs through `expectEngineParity`. COR-1417 made a failed run
 * recordable: the chunks that arrived before the failure are kept and compared,
 * and the failure itself is compared as `{ name, message }` (never `stack`, which
 * embeds a checkout-specific path), so the variant needs no declared difference.
 *
 * `model-4xx` now runs through `expectEngineParity`: COR-1429 makes the stale
 * check scenario-aware, so its matching `finish.stepResult` does not make the
 * unrelated COR-1390 finish declaration fail before comparison.
 */

import { describe, it, expect } from 'vitest';
import { MockMemory } from '../../../memory/mock';
import { Agent } from '../../agent';
import {
  type EngineParityScenario,
  type EngineParityResults,
  type ModelScript,
  FAILED_STEP_WARNINGS_DIFFERENCE,
  PARITY_ENGINES,
  expectEngineParity,
} from './parity-harness';

const THREAD = 'thread-t37';
const RESOURCE = 'resource-t37';

/** The model fails before producing any output. */
const MODEL_4XX: ModelScript = {
  respond: () => {
    throw new Error('T37 model 400');
  },
};

/** The model streams one text delta, then the stream errors. */
const STREAM_CUT: ModelScript = {
  respond: () => [
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id: 'parity-id-0', modelId: 'parity-model', timestamp: new Date(0) },
    { type: 'text-start', id: 'text-1' },
    { type: 'text-delta', id: 'text-1', delta: 'partial ' },
    { type: 'error', error: new Error('T37 stream cut') },
  ],
};

/** One turn of `input` on every engine. */
function scenario(model: ModelScript): EngineParityScenario {
  return {
    model,
    buildAgent: ({ model: recordingModel }) =>
      new Agent({
        id: 't37-agent',
        name: 'T37 Agent',
        instructions: 'Follow the script.',
        model: recordingModel,
        // The case asserts the first failure, not a retry sequence.
        maxRetries: 0,
        memory: new MockMemory(),
      }),
    input: 'Go.',
    options: { memory: { thread: THREAD, resource: RESOURCE } },
    ...(model === MODEL_4XX
      ? {
          differences: {
            durable: FAILED_STEP_WARNINGS_DIFFERENCE,
            evented: FAILED_STEP_WARNINGS_DIFFERENCE,
          },
        }
      : {}),
  };
}

/** Every engine's snapshot for the scenario's single turn. */
function turnsByEngine(results: EngineParityResults) {
  return PARITY_ENGINES.map(engine => {
    const turn = results[engine]?.turns[0];
    expect(turn, `${engine} produced a turn`).toBeDefined();
    return { engine, turn: turn! };
  });
}

describe('T37 error surfaces (plain, durable, evented)', () => {
  it('model-4xx: an up-front model failure surfaces the same way on every engine', async () => {
    const results = await expectEngineParity(scenario(MODEL_4XX));

    for (const { engine, turn } of turnsByEngine(results)) {
      expect(turn.chunks, `${engine} chunks`).toEqual([
        'AGENT:start',
        'AGENT:step-start',
        'AGENT:error',
        'AGENT:step-finish',
        'AGENT:finish',
      ]);
      expect(turn.finishReason, `${engine} finishReason`).toBe('error');
      expect(turn.streamedText, `${engine} streamedText`).toBe('');
      expect(turn.error, `${engine} error`).toStrictEqual({ name: 'Error', message: 'T37 model 400' });
      expect(results[engine]?.requests.length, `${engine} model calls`).toBe(1);
    }
  });

  it('stream-cut: the partial text survives and the failure surfaces the same way on every engine', async () => {
    const results = await expectEngineParity(scenario(STREAM_CUT));

    for (const { engine, turn } of turnsByEngine(results)) {
      // The delta that arrived before the failure is kept, and the failure is
      // recorded rather than raised.
      expect(turn.chunks, `${engine} chunks`).toEqual([
        'AGENT:start',
        'AGENT:step-start',
        'AGENT:text-start',
        'AGENT:text-delta',
        'AGENT:error',
        'AGENT:step-finish',
        'AGENT:finish',
      ]);
      expect(turn.streamedText, `${engine} streamedText`).toBe('partial ');
      expect(turn.text, `${engine} text`).toBe('partial ');
      expect(turn.finishReason, `${engine} finishReason`).toBe('error');
      expect(turn.error, `${engine} error`).toStrictEqual({ name: 'Error', message: 'T37 stream cut' });
      expect(results[engine]?.requests.length, `${engine} model calls`).toBe(1);
    }
  });
});
