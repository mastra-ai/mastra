import { z } from 'zod';
import type { PubSub } from '../../../../events/pubsub';
import type { Mastra } from '../../../../mastra';
import { PUBSUB_SYMBOL } from '../../../../workflows/constants';
import { createStep } from '../../../../workflows/workflow';
import { MessageList } from '../../../message-list';
import { DurableStepIds } from '../../constants';
import { globalRunRegistry } from '../../run-registry';
import { emitChunkEvent } from '../../stream-adapter';

const SIGNAL_DRAIN_STEP_ID = `${DurableStepIds.AGENTIC_EXECUTION}-signal-drain`;

/**
 * Create a durable signal drain step.
 *
 * Mirrors the regular agent's `signalDrainStep` which sits between
 * backgroundTaskCheckStep and isTaskCompleteStep:
 * - Drains any signals queued while tool execution was running
 * - Adds drained signals to the messageList transcript
 * - Emits signal chunks via pubsub for the stream adapter
 * - Sets isContinued=true so the LLM processes the signals on the next turn
 * - Best-effort: swallows errors so signals remain queued on failure
 */
export function createDurableSignalDrainStep() {
  return createStep({
    id: SIGNAL_DRAIN_STEP_ID,
    inputSchema: z.any(),
    outputSchema: z.any(),
    execute: async params => {
      const { inputData, getInitData } = params;
      const execOutput = inputData as Record<string, any>;
      const initData = getInitData<{ runId: string }>();
      const runId = initData.runId;
      const registryEntry = globalRunRegistry.get(runId);
      const drainFn = registryEntry?.drainPendingSignals;

      if (!drainFn) return execOutput;

      try {
        const pendingSignals = drainFn('pending');
        if (pendingSignals.length === 0) return execOutput;

        const drainList = new MessageList();
        drainList.deserialize(execOutput.messageListState);
        drainList.markResponseMessageBoundary(execOutput.messageId);

        const nextMessageId =
          (params.mastra as Mastra | undefined)?.generateId?.() ??
          globalThis.crypto?.randomUUID?.() ??
          `msg_${Date.now()}`;

        const pubsub = (params as any)[PUBSUB_SYMBOL] as PubSub | undefined;
        for (const pendingSignal of pendingSignals) {
          const signalForTranscript = drainList.addSignal(pendingSignal);
          if (pubsub) {
            await emitChunkEvent(pubsub, runId, signalForTranscript.toDataPart() as any);
          }
        }

        return {
          ...execOutput,
          messageListState: drainList.serialize(),
          messageId: nextMessageId,
          stepResult: {
            ...execOutput.stepResult,
            messageId: nextMessageId,
            isContinued: true,
          },
        };
      } catch {
        // Signal drain is best-effort; drainPendingSignals() is inside
        // the try so signals remain queued if it throws.
        return execOutput;
      }
    },
  });
}
