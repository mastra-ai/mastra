import type { ToolSet } from '@internal/ai-sdk-v5';
import type { ChunkType } from '../../../stream/types';
import { createStep } from '../../../workflows/workflow';
import { readScoped } from '../../run-scope-access';
import { AGENT_KEY, DRAIN_PENDING_SIGNALS_KEY } from '../../run-scope-keys';
import type { OuterLLMRun } from '../../types';
import { llmIterationOutputSchema } from '../schema';
import type { LLMIterationData } from '../schema';
import { processSignalInput } from './process-signal-input';

export function createSignalDrainStep<Tools extends ToolSet = ToolSet, OUTPUT = undefined>({
  _internal,
  controller,
  runId,
  messageList,
  mastra,
  rotateResponseMessageId,
  inputProcessors,
  logger,
  agentId,
  processorStates,
  requestContext,
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
      const approvedSignals = await processSignalInput({
        signals: pendingSignals,
        inputProcessors,
        logger,
        agentId,
        agent: readScoped(scopeCtx, AGENT_KEY, 'agent'),
        processorStates,
        requestContext,
      });
      if (approvedSignals.length === 0) {
        return typedInput;
      }

      messageList.markResponseMessageBoundary(typedInput.stepResult?.messageId ?? typedInput.messageId);
      const nextMessageId = rotateResponseMessageId();
      for (const pendingSignal of approvedSignals) {
        const signalForTranscript = messageList.addSignal(pendingSignal);
        controller.enqueue(signalForTranscript.toDataPart() as unknown as ChunkType<OUTPUT>);
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
