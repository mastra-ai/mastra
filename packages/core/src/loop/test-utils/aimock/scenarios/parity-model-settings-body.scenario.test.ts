/**
 * Ported from validation harness case T28 (model-settings-body).
 *
 * Whatever the caller puts on the request must arrive at the model unchanged:
 * `modelSettings` values, `providerOptions`, and the per-model-config `headers`
 * must all show up in the body the model actually receives, on every engine.
 * The harness asserts this on the captured request body — not on the answer —
 * so this file reads `requests` and checks the call, and header *values* are
 * deliberately not asserted (the harness never records them, only their keys).
 */
import { expect, it } from 'vitest';
import { Agent } from '../../../../agent';
import { MockMemory } from '../../../../memory/mock';
import type { CapturedRequest, ParitySnapshot, ParityTarget } from '../parity';
import { chunksOfType, describeParity, expectParity, textOnlyTape } from '../parity';

/** The harness's `settings` variant body, field for field. */
const MODEL_SETTINGS = {
  temperature: 0.2,
  topP: 0.9,
  maxOutputTokens: 77,
  stopSequences: ['END'],
  seed: 7,
};

/**
 * Runs the T28 scenario with the given per-variant additions. `headers` swaps
 * the agent's model for a single-entry fallback array carrying a header key.
 */
async function runT28(
  target: ParityTarget,
  variant: 'settings' | 'provider-options' | 'headers',
  options: Record<string, unknown> = {},
) {
  return expectParity(target, {
    model: { respond: () => textOnlyTape('ok') },
    buildAgent: ({ model }) =>
      new Agent({
        id: 't28-agent',
        name: 't28',
        instructions: 'Follow the script.',
        model: variant === 'headers' ? [{ model, headers: { 'x-t28': '1' }, maxRetries: 0 }] : model,
        memory: new MockMemory(),
      }),
    run: async handle => {
      await handle.turn('Go.', {
        maxSteps: 2,
        memory: { thread: `t28-thread-${variant}`, resource: 't28-resource' },
        ...options,
      });
    },
  });
}

/** 'run settled' — the harness's one check every variant shares. */
function expectSettled(turn: ParitySnapshot | undefined) {
  expect(chunksOfType(turn!, 'finish')).toBe(1);
  expect(turn!.finishReason).toBe('stop');
}

function firstCall(requests: CapturedRequest[]): CapturedRequest {
  expect(requests).toHaveLength(1);
  return requests[0]!;
}

describeParity('model-settings-body parity', target => {
  it('modelSettings reach the model call', async () => {
    const results = await runT28(target, 'settings', { modelSettings: MODEL_SETTINGS });

    for (const engine of ['plain', target] as const) {
      expectSettled(results[engine]!.turns.at(-1));
      const call = firstCall(results[engine]!.requests);
      expect(call.temperature).toBe(0.2);
      expect(call.topP).toBe(0.9);
      expect(call.maxOutputTokens).toBe(77);
      expect(call.stopSequences).toEqual(['END']);
      expect(call.seed).toBe(7);
    }
  });

  it('providerOptions reach the model call', async () => {
    const results = await runT28(target, 'provider-options', { providerOptions: { cor1252: { flag: 'x' } } });

    for (const engine of ['plain', target] as const) {
      expectSettled(results[engine]!.turns.at(-1));
      const call = firstCall(results[engine]!.requests);
      expect((call.providerOptions as { cor1252?: { flag?: string } } | undefined)?.cor1252?.flag).toBe('x');
    }
  });

  it('per-model header keys reach the model call', async () => {
    const results = await runT28(target, 'headers');

    for (const engine of ['plain', target] as const) {
      expectSettled(results[engine]!.turns.at(-1));
      const call = firstCall(results[engine]!.requests);
      expect(call.headers?.['x-t28'], `${engine}: the configured header reaches the model call`).toBe('1');
    }
  });
});
