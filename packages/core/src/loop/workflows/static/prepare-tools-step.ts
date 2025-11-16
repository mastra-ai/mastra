import { z } from 'zod';
import { createStep } from '../../../workflows';
import { executionWorkflowStateSchema } from './schema';

/**
 * Output schema for the prepare tools step
 */
const coreToolSchema = z.object({
  id: z.string().optional(),
  description: z.string().optional(),
  parameters: z.union([
    z.record(z.string(), z.any()), // JSON Schema as object
    z.any(), // Zod schema or other schema types - validated at tool execution
  ]),
  outputSchema: z.union([z.record(z.string(), z.any()), z.any()]).optional(),
  execute: z.function(z.tuple([z.any(), z.any()]), z.promise(z.any())).optional(),
  type: z.union([z.literal('function'), z.literal('provider-defined'), z.undefined()]).optional(),
  args: z.record(z.string(), z.any()).optional(),
});

export const prepareToolsStepOutputSchema = z.object({
  convertedTools: z.record(z.string(), coreToolSchema),
});

/**
 * Creates the prepare tools step that converts and enhances tools for the LLM.
 * This step runs in parallel with prepareMemoryStep.
 *
 * Uses workflow state to access request-specific data instead of closures,
 * preventing memory leaks from recreating the workflow on each request.
 */
export function createPrepareToolsStep() {
  return createStep({
    id: 'prepare-tools-step',
    stateSchema: executionWorkflowStateSchema,
    inputSchema: z.object({}),
    outputSchema: prepareToolsStepOutputSchema,
    execute: async ({ state }) => {
      // Extract all request-specific data from state instead of closure
      const {
        capabilities,
        options,
        runId,
        threadFromArgs,
        resourceId,
        requestContext,
        agentSpan,
        methodType,
        memory,
      } = state;

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
        requestContext,
        tracingContext: { currentSpan: agentSpan },
        writableStream: options.writableStream,
        methodType,
      });

      return {
        convertedTools,
      };
    },
  });
}
