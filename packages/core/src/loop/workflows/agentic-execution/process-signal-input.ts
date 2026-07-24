import type { Agent } from '../../../agent';
import { MessageList } from '../../../agent/message-list';
import type { CreatedAgentSignal } from '../../../agent/signals';
import { TripWire } from '../../../agent/trip-wire';
import type { IMastraLogger } from '../../../logger';
import { ConsoleLogger } from '../../../logger';
import type { InputProcessorOrWorkflow, ProcessorState } from '../../../processors';
import { ProcessorRunner } from '../../../processors/runner';
import type { RequestContext } from '../../../request-context';

/**
 * Runs input processors on pending signals before they enter the main message list.
 */
export async function processSignalInput({
  signals,
  inputProcessors,
  logger,
  agentId,
  agent,
  processorStates,
  requestContext,
}: {
  signals: CreatedAgentSignal[];
  inputProcessors?: InputProcessorOrWorkflow[];
  logger?: IMastraLogger;
  agentId?: string;
  agent?: Agent<any, any, any, any>;
  processorStates?: Map<string, ProcessorState>;
  requestContext?: RequestContext;
}): Promise<CreatedAgentSignal[]> {
  if (!inputProcessors?.length || signals.length === 0) {
    return signals;
  }

  const effectiveLogger = logger || new ConsoleLogger({ level: 'error' });
  const approved: CreatedAgentSignal[] = [];

  for (const signal of signals) {
    const tempMessageList = new MessageList();
    tempMessageList.add(signal.toDBMessage(), 'input');

    const runner = new ProcessorRunner({
      inputProcessors,
      outputProcessors: [],
      logger: effectiveLogger,
      agentName: agentId || 'unknown',
      agent,
      processorStates,
    });

    try {
      await runner.runInputProcessors(tempMessageList, undefined, requestContext, 0);

      if (tempMessageList.get.input.db().length === 0) {
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

      effectiveLogger.error('Error processing signal through input processors', { signalId: signal.id, error });
      approved.push(signal);
    }
  }

  return approved;
}
