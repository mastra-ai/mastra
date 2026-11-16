import { describe, expect, it } from 'vitest';
import { buildStreamErrorMessage, isMaxStepsFinishChunk } from '../stream-error-message';

describe('stream error messages', () => {
  describe('when a run ends on a tool call (#29612)', () => {
    const finish = ({
      type = 'finish',
      reason = 'tool-calls',
      steps,
    }: {
      type?: string;
      reason?: string;
      steps: unknown[];
    }) => ({
      type,
      payload: { stepResult: { reason }, output: { steps } },
    });
    const step = (finishReason: string) => ({ finishReason });

    it('warns only once every step in the budget is used', () => {
      const threeToolSteps = [step('tool-calls'), step('tool-calls'), step('tool-calls')];
      expect(isMaxStepsFinishChunk({ chunk: finish({ steps: threeToolSteps }), maxSteps: 3 })).toBe(true);
      expect(isMaxStepsFinishChunk({ chunk: finish({ steps: threeToolSteps }), maxSteps: 10 })).toBe(false);
    });

    it('does not count processor retry steps against the budget', () => {
      const steps = [step('retry'), step('tool-calls'), step('tool-calls')];
      expect(isMaxStepsFinishChunk({ chunk: finish({ steps }), maxSteps: 3 })).toBe(false);
      expect(isMaxStepsFinishChunk({ chunk: finish({ steps }), maxSteps: 2 })).toBe(true);
    });

    it('does not warn without a known limit or step list', () => {
      expect(isMaxStepsFinishChunk({ chunk: finish({ steps: [step('tool-calls')] }), maxSteps: undefined })).toBe(
        false,
      );
      expect(
        isMaxStepsFinishChunk({
          chunk: { type: 'finish', payload: { stepResult: { reason: 'tool-calls' } } },
          maxSteps: 1,
        }),
      ).toBe(false);
    });

    it('ignores step-finish chunks and runs the model ended', () => {
      expect(
        isMaxStepsFinishChunk({ chunk: finish({ type: 'step-finish', steps: [step('tool-calls')] }), maxSteps: 1 }),
      ).toBe(false);
      expect(isMaxStepsFinishChunk({ chunk: finish({ reason: 'stop', steps: [step('stop')] }), maxSteps: 1 })).toBe(
        false,
      );
    });
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
