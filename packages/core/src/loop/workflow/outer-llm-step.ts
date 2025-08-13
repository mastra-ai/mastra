import z from 'zod';
import { createWorkflow } from '../../workflows';
import type { OuterLLMRun } from '../types';
import { createLLMExecutionStep } from './llm-execution';
import { llmIterationOutputSchema } from './schema';

export function createOuterLLMWorkflow({
  model,
  telemetry_settings,
  _internal,
  modelStreamSpan,
  ...rest
}: OuterLLMRun) {
  const llmExecutionStep = createLLMExecutionStep({
    model,
    _internal,
    ...rest,
  });

  return (
    createWorkflow({
      id: 'executionWorkflow',
      inputSchema: llmIterationOutputSchema,
      outputSchema: z.any(),
    })
      .then(llmExecutionStep)
      .map(({ inputData }) => {
        if (modelStreamSpan && telemetry_settings?.recordOutputs !== false && inputData.output.toolCalls?.length) {
          modelStreamSpan.setAttribute('stream.response.toolCalls', JSON.stringify(inputData.output.toolCalls));
        }
        return inputData.output.toolCalls || [];
      })
      // .foreach(toolCallExecutionStep)
      // .then(llmExecutionMappingStep)
      .commit()
  );
}
