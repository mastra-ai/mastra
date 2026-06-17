import type { CreatedAgentSignal } from '../../../agent/signals';
import { MessageList } from '../../../agent/message-list';
import { TripWire } from '../../../agent/trip-wire';
import type { IMastraLogger } from '../../../logger';
import { ConsoleLogger } from '../../../logger';
import type { InputProcessorOrWorkflow, ProcessorState } from '../../../processors';
import { ProcessorRunner } from '../../../processors/runner';
import type { RequestContext } from '../../../request-context';

/**
 * Runs `processInput` on pending signals before they enter the main message list.
 *
 * Security processors (prompt injection detection, moderation, PII filtering, etc.)
 * typically only implement `processInput`. Without this step, signals arriving mid-run
 * (via signalDrainStep, pre-run drain, or dowhile drain) would bypass those guardrails
 * because the mid-run path only invokes `processInputStep`.
 *
 * Each signal is evaluated individually. Signals that pass are returned as-is.
 * Signals that trigger a TripWire or are filtered out by a processor are dropped
 * and logged — the run continues without the rejected signal content.
 */
export async function processSignalInput({
  signals,
  inputProcessors,
  logger,
  agentId,
  processorStates,
  requestContext,
}: {
  signals: CreatedAgentSignal[];
  inputProcessors?: InputProcessorOrWorkflow[];
  logger?: IMastraLogger;
  agentId?: string;
  processorStates?: Map<string, ProcessorState>;
  requestContext?: RequestContext;
}): Promise<CreatedAgentSignal[]> {
  if (!inputProcessors || inputProcessors.length === 0 || signals.length === 0) {
    return signals;
  }

  const effectiveLogger = logger || new ConsoleLogger({ level: 'error' });
  const approved: CreatedAgentSignal[] = [];

  for (const signal of signals) {
    // Create a temporary message list containing only this signal's message
    const tempMessageList = new MessageList();
    tempMessageList.add(signal.toDBMessage(), 'input');

    const runner = new ProcessorRunner({
      inputProcessors,
      outputProcessors: [],
      logger: effectiveLogger,
      agentName: agentId || 'unknown',
      processorStates,
    });

    try {
      await runner.runInputProcessors(tempMessageList, undefined, requestContext, 0);

      // Check if the signal's message was filtered out by a processor
      const remainingMessages = tempMessageList.get.input.db();
      if (remainingMessages.length === 0) {
        effectiveLogger.warn('Signal filtered out by input processor', {
          signalId: signal.id,
          signalType: signal.type,
        });
        continue;
      }

      approved.push(signal);
    } catch (error) {
      if (error instanceof TripWire) {
        effectiveLogger.warn('Signal rejected by input processor', {
          signalId: signal.id,
          signalType: signal.type,
          processorId: error.processorId,
          reason: error.message,
        });
        continue;
      }
      // Non-TripWire errors should not silently swallow the signal;
      // log and still approve so agent execution isn't disrupted.
      effectiveLogger.error('Error processing signal through input processors', { signalId: signal.id, error });
      approved.push(signal);
    }
  }

  return approved;
}
