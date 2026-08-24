import { describe, expect, it } from 'vitest';
import {
  buildMaxStepsStreamErrorMessage,
  buildStreamErrorMessage,
  isMaxStepsFinishChunk,
} from '../stream-error-message';

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
  describe('isMaxStepsFinishChunk', () => {
    it('ignores a chunk with no type', () => {
      expect(isMaxStepsFinishChunk({ payload: { stepResult: { reason: 'tool-calls' } } })).toBe(false);
    });

    it('ignores a finish chunk with no payload', () => {
      expect(isMaxStepsFinishChunk({ type: 'finish' })).toBe(false);
    });

    it('ignores a finish chunk with no step result', () => {
      expect(isMaxStepsFinishChunk({ type: 'finish', payload: {} })).toBe(false);
    });

    it('ignores a reason that is not a string', () => {
      expect(isMaxStepsFinishChunk({ type: 'finish', payload: { stepResult: { reason: 42 } } })).toBe(false);
    });
  });

  describe('buildStreamErrorMessage', () => {
    const textOf = (message: ReturnType<typeof buildStreamErrorMessage>) =>
      (message.content.parts as Array<{ text: string }>)[0]?.text;

    it('uses a string error payload as-is', () => {
      expect(textOf(buildStreamErrorMessage({ payload: { error: 'plain failure' } }))).toBe('plain failure');
    });

    it('reads the message off a plain object', () => {
      expect(textOf(buildStreamErrorMessage({ payload: { error: { message: 'object failure' } } }))).toBe(
        'object failure',
      );
    });

    it('ignores a non-string message and dumps the object instead', () => {
      expect(textOf(buildStreamErrorMessage({ payload: { error: { message: 42 } } }))).toBe('{"message":42}');
    });

    it('dumps a serializable object that carries no message', () => {
      expect(textOf(buildStreamErrorMessage({ payload: { error: { code: 500 } } }))).toBe('{"code":500}');
    });

    it('reports an explicit null error as unknown', () => {
      expect(textOf(buildStreamErrorMessage({ payload: { error: null } }))).toBe('Unknown error');
    });

    it('marks the message as an assistant error so the UI can style it', () => {
      const message = buildStreamErrorMessage({ runId: 'run-1', payload: { error: 'boom' } });

      expect(message.role).toBe('assistant');
      expect(message.content.metadata).toEqual({ status: 'error' });
      expect(message.content.format).toBe(2);
    });

    it('ties the message id to the run it came from', () => {
      expect(buildStreamErrorMessage({ runId: 'run-7', payload: { error: 'boom' } }).id).toMatch(/^error-run-7-/);
    });

    it('still produces an id when the chunk names no run', () => {
      expect(buildStreamErrorMessage({ payload: { error: 'boom' } }).id).toMatch(/^error-unknown-/);
    });
  });

  describe('buildMaxStepsStreamErrorMessage', () => {
    const textOf = (message: ReturnType<typeof buildStreamErrorMessage>) =>
      (message.content.parts as Array<{ text: string }>)[0]?.text;

    it('names the limit that was reached', () => {
      const text = textOf(buildMaxStepsStreamErrorMessage({ runId: 'run-1' }, 15));

      expect(text).toContain('maxSteps (15)');
      expect(text).toContain('Increase maxSteps in advanced settings');
    });

    it('omits the number when the limit is unknown', () => {
      const text = textOf(buildMaxStepsStreamErrorMessage({ runId: 'run-1' }));

      expect(text).toContain('reached maxSteps while tool calls were still pending');
      expect(text).not.toMatch(/maxSteps \(/);
    });

    it('carries the run id through', () => {
      expect(buildMaxStepsStreamErrorMessage({ runId: 'run-9' }, 5).id).toMatch(/^error-run-9-/);
    });
  });
});
