import type { ToolSet } from 'ai-v5';
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
  OUTPUT extends OutputSchema | undefined = undefined,
>({ model, telemetry_settings, _internal, modelStreamSpan, ...rest }: OuterLLMRun<Tools, OUTPUT>) {
  const llmExecutionStep = createLLMExecutionStep({
    model,
    _internal,
    modelStreamSpan,
    telemetry_settings,
    ...rest,
  });

  const toolCallStep = createToolCallStep({
    model,
    telemetry_settings,
    _internal,
    modelStreamSpan,
    ...rest,
  });

  const llmMappingStep = createLLMMappingStep(
    {
      model,
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
  })
    .then(llmExecutionStep)
    .map(async ({ inputData }) => {
      const typedInputData = inputData as LLMIterationData<Tools>;
      if (modelStreamSpan && telemetry_settings?.recordOutputs !== false && typedInputData.output.toolCalls?.length) {
        modelStreamSpan.setAttribute(
          'stream.response.toolCalls',
          JSON.stringify(
            typedInputData.output.toolCalls?.map(toolCall => {
              return {
                toolCallId: toolCall.toolCallId,
                args: toolCall.input,
                toolName: toolCall.toolName,
              };
            }),
          ),
        );
      }
      return typedInputData.output.toolCalls || [];
    })
    .foreach(toolCallStep, { concurrency: 10 })
    .then(llmMappingStep)
    .commit();
}
