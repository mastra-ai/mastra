import type { ToolSet } from 'ai-v5';
import { InternalSpans } from '../../../ai-tracing';
import type { OutputSchema } from '../../../stream/base/schema';
import { createWorkflow } from '../../../workflows';
import type { OuterLLMRun } from '../../types';
import { llmIterationOutputSchema } from '../schema';
import type { LLMIterationData } from '../schema';
import { createLLMExecutionStep } from './llm-execution-step';
import { createLLMMappingStep } from './llm-mapping-step';
import { createToolCallStep } from './tool-call-step';

interface CreateAgenticExecutionWorkflowOptions {
  logger?: any;
  mastra?: any;
}

export function createAgenticExecutionWorkflow<
  Tools extends ToolSet = ToolSet,
  OUTPUT extends OutputSchema = undefined,
>({ logger, mastra }: CreateAgenticExecutionWorkflowOptions) {
  const llmExecutionStep = createLLMExecutionStep();

  const toolCallStep = createToolCallStep();

  const llmMappingStep = createLLMMappingStep(llmExecutionStep);

  const workflow = createWorkflow({
    id: 'executionWorkflow',
    inputSchema: llmIterationOutputSchema,
    outputSchema: llmIterationOutputSchema,
    options: {
      tracingPolicy: {
        // mark all workflow spans related to the
        // VNext execution as internal
        internal: InternalSpans.WORKFLOW,
      },
      shouldPersistSnapshot: ({ workflowStatus }) => workflowStatus === 'suspended',
    },
  })
    .then(llmExecutionStep)
    .map(
      async ({ inputData, state }) => {
        const typedInputData = inputData as LLMIterationData<Tools, OUTPUT>;
        const { telemetry_settings, modelStreamSpan } = state;
        if (modelStreamSpan && telemetry_settings?.recordOutputs !== false && typedInputData.output.toolCalls?.length) {
          modelStreamSpan.setAttribute(
            'stream.response.toolCalls',
            JSON.stringify(
              typedInputData.output.toolCalls?.map(toolCall => {
                return {
                  toolCallId: toolCall.toolCallId,
                  // @ts-ignore TODO: look into the type here
                  args: toolCall.args,
                  toolName: toolCall.toolName,
                };
              }),
            ),
          );
        }
        return typedInputData.output.toolCalls || [];
      },
      { id: 'map-tool-calls' },
    )
    .foreach(toolCallStep, {
      concurrency: 10,
    })
    .then(llmMappingStep)
    .commit();

  // Register mastra with the workflow if provided
  if (mastra) {
    workflow.__registerMastra(mastra);
  }

  return workflow;
}
