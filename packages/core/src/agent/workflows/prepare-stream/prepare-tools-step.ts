import { createStep } from '../../../workflows';
import type { AgentCapabilities } from './schema';
import { prepareToolsStepOutputSchema } from './schema';
import { prepareStreamWorkflowInputSchema } from './index';

interface PrepareToolsStepOptions {
  capabilities: AgentCapabilities;
}

export function createPrepareToolsStep({ capabilities }: PrepareToolsStepOptions) {
  return createStep({
    id: 'prepare-tools-step',
    inputSchema: prepareStreamWorkflowInputSchema,
    outputSchema: prepareToolsStepOutputSchema,
    execute: async ({ inputData, tracingContext, runtimeContext }) => {
      const { options, threadFromArgs, resourceId, runId, methodType, memory } = inputData;
      const agentAISpan = tracingContext.currentSpan;

      const toolEnhancements = [
        options?.toolsets && Object.keys(options?.toolsets || {}).length > 0
          ? `toolsets present (${Object.keys(options?.toolsets || {}).length} tools)`
          : undefined,
        memory && resourceId ? 'memory and resourceId available' : undefined,
      ]
        .filter(Boolean)
        .join(', ');

      capabilities.logger.debug(`[Agent:${capabilities.agentName}] - Enhancing tools: ${toolEnhancements}`, {
        runId,
        toolsets: options?.toolsets ? Object.keys(options?.toolsets) : undefined,
        clientTools: options?.clientTools ? Object.keys(options?.clientTools) : undefined,
        hasMemory: !!memory,
        hasResourceId: !!resourceId,
      });

      const threadId = threadFromArgs?.id;

      const convertedTools = await capabilities.convertTools({
        toolsets: options?.toolsets,
        clientTools: options?.clientTools,
        threadId,
        resourceId,
        runId,
        runtimeContext,
        tracingContext: { currentSpan: agentAISpan },
        writableStream: options.writableStream,
        methodType,
      });

      return {
        convertedTools,
      };
    },
  });
}
