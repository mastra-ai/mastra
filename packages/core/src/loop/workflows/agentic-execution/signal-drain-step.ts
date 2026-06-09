import type { ToolSet } from '@internal/ai-sdk-v5';
import type { ChunkType } from '../../../stream/types';
import { createStep } from '../../../workflows/workflow';
import type { OuterLLMRun } from '../../types';
import { llmIterationOutputSchema } from '../schema';
import type { LLMIterationData } from '../schema';

export function createSignalDrainStep<Tools extends ToolSet = ToolSet, OUTPUT = undefined>({
  _internal,
  controller,
  runId,
  messageList,
  mastra,
}: OuterLLMRun<Tools, OUTPUT>) {
  return createStep({
    id: 'signalDrainStep',
    inputSchema: llmIterationOutputSchema,
    outputSchema: llmIterationOutputSchema,
    execute: async ({ inputData }) => {
      const typedInput = inputData as LLMIterationData<Tools, OUTPUT>;
      const pendingSignals = _internal?.drainPendingSignals?.(runId) ?? [];
      if (pendingSignals.length === 0) {
        return typedInput;
      }

      messageList.markResponseMessageBoundary(typedInput.stepResult?.messageId ?? typedInput.messageId);
      for (const pendingSignal of pendingSignals) {
        const signalForTranscript = messageList.addSignal(pendingSignal);
        controller.enqueue(signalForTranscript.toDataPart() as unknown as ChunkType<OUTPUT>);
      }

      return {
        ...typedInput,
        messageId: _internal?.generateId?.() ?? mastra?.generateId?.() ?? typedInput.messageId,
        stepResult: {
          ...typedInput.stepResult,
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
