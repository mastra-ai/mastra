import type { ToolSet } from '@internal/ai-sdk-v5';
import { emitPulseFact } from '../../../pulse/emitter';
import type { ChunkType } from '../../../stream/types';
import { createStep } from '../../../workflows/workflow';
import { readScoped } from '../../run-scope-access';
import { DRAIN_PENDING_SIGNALS_KEY } from '../../run-scope-keys';
import type { OuterLLMRun } from '../../types';
import { llmIterationOutputSchema } from '../schema';
import type { LLMIterationData } from '../schema';

export function createSignalDrainStep<Tools extends ToolSet = ToolSet, OUTPUT = undefined>({
  _internal,
  controller,
  runId,
  messageList,
  mastra,
  rotateResponseMessageId,
}: OuterLLMRun<Tools, OUTPUT>) {
  const scopeCtx = { mastra, runId, _internal };
  return createStep({
    id: 'signalDrainStep',
    inputSchema: llmIterationOutputSchema,
    outputSchema: llmIterationOutputSchema,
    execute: async ({ inputData }) => {
      const typedInput = inputData as LLMIterationData<Tools, OUTPUT>;
      const drainPendingSignals = readScoped(scopeCtx, DRAIN_PENDING_SIGNALS_KEY, 'drainPendingSignals');
      const pendingSignals = drainPendingSignals?.(runId) ?? [];
      if (pendingSignals.length === 0) {
        return typedInput;
      }

      messageList.markResponseMessageBoundary(typedInput.stepResult?.messageId ?? typedInput.messageId);
      const nextMessageId = rotateResponseMessageId();
      for (const pendingSignal of pendingSignals) {
        const signalForTranscript = messageList.addSignal(pendingSignal);
        controller.enqueue(signalForTranscript.toDataPart() as unknown as ChunkType<OUTPUT>);
        emitPulseFact({
          runId,
          surface: 'signal_queue',
          action: 'drained',
          type: 'state',
          attributes: { signalId: pendingSignal.id, nextMessageId, forcedContinuation: true, site: 'drain-step' },
          edges: [{ type: 'drained_signal', to: { kind: 'content', id: `signal:${pendingSignal.id}` } }],
        });
      }

      return {
        ...typedInput,
        messageId: nextMessageId,
        stepResult: {
          ...typedInput.stepResult,
          messageId: nextMessageId,
          reason: 'other',
          isContinued: true,
        },
        messages: {
          all: messageList.get.all.aiV5.model(),
          user: messageList.get.input.aiV5.model(),
          nonUser: messageList.get.response.aiV5.model(),
        },
      };
    },
  });
}
