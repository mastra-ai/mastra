import { describe, expect, it } from 'vitest';
import { buildStreamErrorMessage, isMaxStepsFinishChunk } from '../stream-error-message';

describe('stream error messages', () => {
  it('only treats terminal tool-call finish chunks as maxSteps exhaustion', () => {
    expect(
      isMaxStepsFinishChunk({
        type: 'finish',
        payload: {
          stepResult: {
            reason: 'tool-calls',
          },
        },
      }),
    ).toBe(true);

    expect(
      isMaxStepsFinishChunk({
        type: 'step-finish',
        payload: {
          stepResult: {
            reason: 'tool-calls',
          },
        },
      }),
    ).toBe(false);

    expect(
      isMaxStepsFinishChunk({
        type: 'finish',
        payload: {
          stepResult: {
            reason: 'stop',
          },
        },
      }),
    ).toBe(false);
  });

  it('preserves human-readable error payloads', () => {
    expect(
      buildStreamErrorMessage({
        runId: 'run-1',
        payload: { error: new Error('Readable failure') },
      }).content.parts,
    ).toEqual([{ type: 'text', text: 'Readable failure' }]);
  });

  it('falls back safely for missing and unserializable error payloads', () => {
    expect(buildStreamErrorMessage({ runId: 'run-1' }).content.parts).toEqual([
      { type: 'text', text: 'Unknown error' },
    ]);

    const circularError: Record<string, unknown> = { reason: 'circular' };
    circularError.self = circularError;

    expect(
      buildStreamErrorMessage({
        runId: 'run-1',
        payload: { error: circularError },
      }).content.parts,
    ).toEqual([{ type: 'text', text: '[object Object]' }]);

    const hostileError: Record<string, unknown> = {
      toString: () => {
        throw new Error('Cannot stringify');
      },
    };
    hostileError.self = hostileError;

    expect(
      buildStreamErrorMessage({
        runId: 'run-1',
        payload: { error: hostileError },
      }).content.parts,
    ).toEqual([{ type: 'text', text: 'Unknown error' }]);
  });
});
