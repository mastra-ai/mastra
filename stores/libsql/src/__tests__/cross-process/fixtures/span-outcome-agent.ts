/**
 * Shared by the span-outcome test and its worker peers: every process builds the same agent and
 * the same observability, so the run looks like one deploy with an API replica and a worker pool.
 */
import { MastraStorageExporter, Observability } from '@mastra/observability';

import { createStepAgent } from '../step-agent';

export interface SpanOutcomeTripwire {
  reason: string;
  processorId: string;
}

/** One tool call, then text, scripted per run. A `blocked` request-context flag trips the input guard. */
export function createSpanOutcomeAgent(agentId: string, tripwire: SpanOutcomeTripwire) {
  return createStepAgent({
    id: agentId,
    steps: 1,
    perRun: true,
    finalText: 'done',
    inputProcessors: [
      {
        id: tripwire.processorId,
        processInput: ({ messages, requestContext, abort }) => {
          if (requestContext?.get('blocked')) abort(tripwire.reason);
          return messages;
        },
      },
    ],
  });
}

/** Ended spans are inserted whole, so a worker's end never has to find a row another process wrote. */
export function createSpanOutcomeObservability() {
  return new Observability({
    configs: {
      default: {
        serviceName: 'xproc-span-outcome',
        exporters: [new MastraStorageExporter({ strategy: 'insert-only', maxBatchWaitMs: 25 })],
      },
    },
  });
}
