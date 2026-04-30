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
import { createToolCallStep } from './tool-call-step';

export function createAgenticExecutionWorkflow<Tools extends ToolSet = ToolSet, OUTPUT = undefined>({
  models,
  _internal,
  ...rest
}: OuterLLMRun<Tools, OUTPUT>) {
  const llmExecutionStep = createLLMExecutionStep({
    models,
    _internal,
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

  // Sequential execution may be required for tool calls to avoid race conditions, otherwise concurrency is configurable
  let toolCallConcurrency = 10;
  if (rest?.toolCallConcurrency) {
    toolCallConcurrency = rest.toolCallConcurrency > 0 ? rest.toolCallConcurrency : 10;
  }

  // Check for sequential execution requirements:
  // 1. Global requireToolApproval flag
  // 2. Any tool has suspendSchema
  // 3. Any tool has requireApproval flag
  const hasRequireToolApproval = !!rest.requireToolApproval;

  let hasSuspendSchema = false;
  let hasRequireApproval = false;

  if (rest.tools) {
    for (const tool of Object.values(rest.tools)) {
      if ((tool as any)?.hasSuspendSchema) {
        hasSuspendSchema = true;
      }

      if ((tool as any)?.requireApproval) {
        hasRequireApproval = true;
      }

      if (hasSuspendSchema || hasRequireApproval) break;
    }
  }

  const sequentialExecutionRequired = hasRequireToolApproval || hasSuspendSchema || hasRequireApproval;

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
        // Cast to any[] because TypedToolCall<Tools> is a complex conditional type that
        // the map overload cannot infer precisely enough for the downstream foreach step.
        return (typedInputData.output.toolCalls || []) as any[];
      },
      { id: 'map-tool-calls' },
    )
    .foreach(toolCallStep, { concurrency: sequentialExecutionRequired ? 1 : toolCallConcurrency })
    .then(llmMappingStep)
    .then(backgroundTaskCheckStep)
    .then(isTaskCompleteStep)
    .commit();
}
