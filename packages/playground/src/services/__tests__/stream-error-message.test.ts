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
      }).parts,
    ).toEqual([{ type: 'text', text: 'Readable failure' }]);
  });
});
