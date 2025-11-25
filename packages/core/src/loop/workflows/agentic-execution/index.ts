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

export function createAgenticExecutionWorkflow<
  Tools extends ToolSet = ToolSet,
  OUTPUT extends OutputSchema = undefined,
>({ models, telemetry_settings, _internal, modelStreamSpan, ...rest }: OuterLLMRun<Tools, OUTPUT>) {
  const llmExecutionStep = createLLMExecutionStep({
    models,
    _internal,
    modelStreamSpan,
    telemetry_settings,
    ...rest,
  });

  const toolCallStep = createToolCallStep({
    models,
    telemetry_settings,
    _internal,
    modelStreamSpan,
    ...rest,
  });

  const llmMappingStep = createLLMMappingStep(
    {
      models,
      telemetry_settings,
      _internal,
      modelStreamSpan,
      ...rest,
    },
    llmExecutionStep,
  );

  return createWorkflow({
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
      async ({ inputData }) => {
        const typedInputData = inputData as LLMIterationData<Tools, OUTPUT>;
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
        // Add assistant response messages to messageList BEFORE processing tool calls
        // This ensures messages are available for persistence before suspension
        const responseMessages = typedInputData.messages.nonUser;
        if (responseMessages && responseMessages.length > 0) {
          rest.messageList.add(responseMessages, 'response');
        }
        return typedInputData;
      },
      { id: 'add-response-to-messagelist' },
    )
    .map(
      async ({ inputData }) => {
        const typedInputData = inputData as LLMIterationData<Tools, OUTPUT>;
        return typedInputData.output.toolCalls || [];
      },
      { id: 'map-tool-calls' },
    )
    .foreach(toolCallStep, { concurrency: 10 })
    .then(llmMappingStep)
    .commit();
}
