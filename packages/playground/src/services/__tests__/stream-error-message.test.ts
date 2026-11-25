import {
  buildStreamErrorMessage,
  isMaxStepsFinishChunk,
} from '@mastra/playground-ui/domains/agents/chat/stream-error-message';
import { describe, expect, it } from 'vitest';
import {
  askQuestionInBrowser,
  broadcastQuestionAgent,
  endTurnFromHook,
  stopAfterQuestion,
  streamQuestionAgent,
  streamRetriedQuestionAgent,
} from '../../lib/ai-ui/chat/__tests__/fixtures/question-agent';

type Chunk = Parameters<typeof isMaxStepsFinishChunk>[0]['chunk'];
type FinishChunk = Extract<Chunk, { type: 'finish' }>;

const finishOf = (chunks: Chunk[]): FinishChunk => {
  const finish = chunks.find((chunk): chunk is FinishChunk => chunk.type === 'finish');
  if (!finish) throw new Error('the run produced no finish chunk');
  return finish;
};

/** The same finish as a server on a @mastra/core from before `stopCause` sends it. */
const withoutStopCause = ({ payload: { stopCause: _stopCause, ...payload }, ...chunk }: FinishChunk): FinishChunk => ({
  ...chunk,
  payload,
});

describe('stream error messages', () => {
  // Real runs of an agent whose model calls a tool on every step. (#29612)
  describe('when core reports why the run stopped', () => {
    it('warns when the run ran out of steps', async () => {
      const finish = finishOf(await streamQuestionAgent({ maxSteps: 1 }));
      expect(isMaxStepsFinishChunk({ chunk: finish, maxSteps: 1 })).toBe(true);
    });

    it.each([
      { name: 'a client tool', options: { clientTools: { askQuestion: askQuestionInBrowser } } },
      { name: 'onIterationComplete', options: { onIterationComplete: endTurnFromHook } },
    ])('does not warn when $name ended the run on its last allowed step', async ({ options }) => {
      const finish = finishOf(await streamQuestionAgent({ maxSteps: 1, ...options }));
      expect(isMaxStepsFinishChunk({ chunk: finish, maxSteps: 1 })).toBe(false);
    });

    it('does not warn when stopWhen ended the run with steps to spare', async () => {
      const finish = finishOf(await streamQuestionAgent({ maxSteps: 10, stopWhen: stopAfterQuestion }));
      expect(isMaxStepsFinishChunk({ chunk: finish, maxSteps: 10 })).toBe(false);
    });

    it('does not warn when the model ended its last step without a tool call', async () => {
      const finish = finishOf(await streamQuestionAgent({ maxSteps: 1 }));
      const answered: FinishChunk = {
        ...finish,
        payload: { ...finish.payload, stepResult: { ...finish.payload.stepResult, reason: 'stop' } },
      };
      expect(isMaxStepsFinishChunk({ chunk: answered, maxSteps: 1 })).toBe(false);
    });

    it('ignores the step-finish that precedes the finish', async () => {
      const stepFinish = (await streamQuestionAgent({ maxSteps: 1 })).find(chunk => chunk.type === 'step-finish');
      expect(stepFinish && isMaxStepsFinishChunk({ chunk: stepFinish, maxSteps: 1 })).toBe(false);
    });
  });

  describe('when an older core reports no stop cause', () => {
    it('does not infer exhaustion from step count when stopCause is absent', async () => {
      const finish = withoutStopCause(finishOf(await streamQuestionAgent({ maxSteps: 3 })));
      expect(isMaxStepsFinishChunk({ chunk: finish, maxSteps: 3 })).toBe(false);
    });

    it.each([
      { name: 'a client tool', options: { clientTools: { askQuestion: askQuestionInBrowser } } },
      { name: 'onIterationComplete', options: { onIterationComplete: endTurnFromHook } },
    ])(
      'does not warn when $name ended the run on its last allowed step and stopCause is absent',
      async ({ options }) => {
        const finish = withoutStopCause(finishOf(await streamQuestionAgent({ maxSteps: 1, ...options })));
        expect(isMaxStepsFinishChunk({ chunk: finish, maxSteps: 1 })).toBe(false);
      },
    );

    it('does not warn when the run stopped with steps to spare', async () => {
      const finish = withoutStopCause(
        finishOf(await streamQuestionAgent({ maxSteps: 10, stopWhen: stopAfterQuestion })),
      );
      expect(isMaxStepsFinishChunk({ chunk: finish, maxSteps: 10 })).toBe(false);
    });

    it('does not warn after a processor retry', async () => {
      const finish = withoutStopCause(finishOf(await streamRetriedQuestionAgent({ maxSteps: 2 })));
      expect(finish.payload.output.steps?.map(step => step.tripwire?.retry === true)).toEqual([true, false]);
      expect(isMaxStepsFinishChunk({ chunk: finish, maxSteps: 2 })).toBe(false);
    });

    it('does not warn without a known limit', async () => {
      const finish = withoutStopCause(finishOf(await streamQuestionAgent({ maxSteps: 1 })));
      expect(isMaxStepsFinishChunk({ chunk: finish, maxSteps: undefined })).toBe(false);
    });

    it('does not warn from a thread subscription copy, which has no steps to count', async () => {
      const finish = withoutStopCause(finishOf(await broadcastQuestionAgent({ maxSteps: 1 })));
      expect(isMaxStepsFinishChunk({ chunk: finish, maxSteps: 1 })).toBe(false);
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
