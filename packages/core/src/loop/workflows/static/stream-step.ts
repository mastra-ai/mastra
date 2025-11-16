import { z } from 'zod';
import type { ModelLoopStreamArgs } from '../../../llm/model/model.loop.types';
import { RequestContext } from '../../../request-context';
import { AISDKV5OutputStream, MastraModelOutput } from '../../../stream';
import type { OutputSchema } from '../../../stream/base/schema';
import { createStep } from '../../../workflows';
import { executionWorkflowStateSchema } from './schema';

/**
 * Creates the stream step that executes the LLM stream call.
 * This step receives ModelLoopStreamArgs from the mapResultsStep via inputData.
 *
 * Uses workflow state to access request-specific data instead of closures,
 * preventing memory leaks from recreating the workflow on each request.
 */
export function createStreamStep<OUTPUT extends OutputSchema | undefined = undefined>() {
  return createStep({
    id: 'stream-text-step',
    stateSchema: executionWorkflowStateSchema,
    inputSchema: z.any(), // ModelLoopStreamArgs - tried to type this in various ways but it's too complex
    outputSchema: z.union([
      z.instanceof(MastraModelOutput<OUTPUT | undefined>),
      z.instanceof(AISDKV5OutputStream<OUTPUT | undefined>),
    ]),
    execute: async ({ state, inputData, tracingContext }) => {
      // Extract state data
      const { capabilities, runId, returnScorerData, requireToolApproval, resumeContext, agentId, toolCallId } = state;

      // inputData comes from mapResultsStep and contains ModelLoopStreamArgs
      const validatedInputData = inputData as ModelLoopStreamArgs<any, OUTPUT>;

      capabilities.logger.debug(`Starting agent ${capabilities.agentName} llm stream call`, {
        runId,
      });

      const processors =
        validatedInputData.outputProcessors ||
        (capabilities.outputProcessors
          ? typeof capabilities.outputProcessors === 'function'
            ? await capabilities.outputProcessors({
                requestContext: validatedInputData.requestContext || new RequestContext(),
              })
            : capabilities.outputProcessors
          : []);

      const streamResult = capabilities.llm.stream({
        ...validatedInputData,
        outputProcessors: processors,
        returnScorerData,
        tracingContext,
        requireToolApproval,
        resumeContext,
        _internal: {
          generateId: capabilities.generateMessageId,
        },
        agentId,
        toolCallId,
      });

      return streamResult;
    },
  });
}
