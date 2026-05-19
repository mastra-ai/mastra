import { describe, expect, it } from 'vitest';
import {
  buildMaxStepsStreamErrorMessage,
  buildStreamErrorMessage,
  getFinishReason,
  getMaxStepsErrorText,
  isMaxStepsFinishChunk,
} from '../stream-error-message';

describe('stream error messages', () => {
  it('detects maxSteps finish chunks from vNext agent streams', () => {
    const chunk = {
      type: 'finish',
      runId: 'run-1',
      payload: {
        stepResult: {
          reason: 'tool-calls',
        },
      },
    };

    expect(getFinishReason(chunk)).toBe('tool-calls');
    expect(isMaxStepsFinishChunk(chunk)).toBe(true);
  });

  it('ignores non-terminal tool-call step finishes', () => {
    const chunk = {
      type: 'step-finish',
      runId: 'run-1',
      payload: {
        stepResult: {
          reason: 'tool-calls',
        },
      },
    };

    expect(getFinishReason(chunk)).toBeUndefined();
    expect(isMaxStepsFinishChunk(chunk)).toBe(false);
  });

  it('builds a persisted chat error for maxSteps exhaustion', () => {
    const message = buildMaxStepsStreamErrorMessage(
      {
        type: 'finish',
        runId: 'run-1',
        payload: {
          stepResult: {
            reason: 'tool-calls',
          },
        },
      },
      5,
    );

    expect(message).toMatchObject({
      role: 'assistant',
      parts: [{ type: 'text', text: getMaxStepsErrorText(5) }],
      metadata: { status: 'error' },
    });
    expect(message.id).toMatch(/^error-run-1-\d+$/);
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
