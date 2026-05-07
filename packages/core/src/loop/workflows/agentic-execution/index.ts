import type { ToolSet } from '@internal/ai-sdk-v5';
import { InternalSpans } from '../../../observability';
import { createWorkflow } from '../../../workflows';
import type { OuterLLMRun } from '../../types';
import { llmIterationOutputSchema } from '../schema';
import type { LLMIterationData } from '../schema';
import { createBackgroundTaskCheckStep } from './background-task-check-step';
import { createIsTaskCompleteStep } from './is-task-complete-step';
import { createLLMExecutionStep } from './llm-execution-step';
import { createLLMMappingStep } from './llm-mapping-step';
import { resolveConfiguredToolCallConcurrency, resolveToolCallConcurrency } from './tool-call-concurrency';
import type { ToolCallForeachOptions } from './tool-call-concurrency';
import { createToolCallStep } from './tool-call-step';

export function createAgenticExecutionWorkflow<Tools extends ToolSet = ToolSet, OUTPUT = undefined>({
  models,
  _internal,
  ...rest
}: OuterLLMRun<Tools, OUTPUT>) {
  const configuredToolCallConcurrency = resolveConfiguredToolCallConcurrency(rest.toolCallConcurrency);
  const toolCallForeachOptions: ToolCallForeachOptions = {
    // This initial value is a conservative fallback for resume paths that can enter
    // a suspended foreach before llm-execution recomputes the effective step tools.
    concurrency: resolveToolCallConcurrency({
      requireToolApproval: rest.requireToolApproval,
      tools: rest.tools,
      activeTools: rest.activeTools as string[] | undefined,
      configuredConcurrency: configuredToolCallConcurrency,
    }),
  };

  const llmExecutionStep = createLLMExecutionStep({
    models,
    _internal,
    toolCallForeachOptions,
    ...rest,
  });

  const toolCallStep = createToolCallStep({
    models,
    _internal,
    ...rest,
  });

  const llmMappingStep = createLLMMappingStep(
    {
      models,
      _internal,
      ...rest,
    },
    llmExecutionStep,
  );

  const backgroundTaskCheckStep = createBackgroundTaskCheckStep({
    models,
    _internal,
    ...rest,
  });

  const isTaskCompleteStep = createIsTaskCompleteStep({
    models,
    _internal,
    ...rest,
  });

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
      validateInputs: false,
    },
  })
    .then(llmExecutionStep)
    .map(
      async ({ inputData }) => {
        const typedInputData = inputData as LLMIterationData<Tools, OUTPUT>;
        return typedInputData.output.toolCalls || [];
      },
      { id: 'map-tool-calls' },
    )
    .foreach(toolCallStep, toolCallForeachOptions)
    .then(llmMappingStep)
    .then(backgroundTaskCheckStep)
    .then(isTaskCompleteStep)
    .commit();
}
