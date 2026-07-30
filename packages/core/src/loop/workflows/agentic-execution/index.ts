import type { ToolSet } from '@internal/ai-sdk-v5';
import { InternalSpans } from '../../../observability';
import { createWorkflow } from '../../../workflows/create';
import type { OuterLLMRun } from '../../types';
import { pruneAgentLoopSnapshot } from '../prune-snapshot';
import { llmIterationOutputSchema } from '../schema';
import type { LLMIterationData } from '../schema';
import { createBackgroundTaskCheckStep } from './background-task-check-step';
import { createGoalStep } from './goal-step';
import { createIsTaskCompleteStep } from './is-task-complete-step';
import { createLLMExecutionStep } from './llm-execution-step';
import { createLLMMappingStep } from './llm-mapping-step';
import { createSignalDrainStep } from './signal-drain-step';
import {
  resolveConfiguredToolCallConcurrency,
  resolveToolCallConcurrency,
  resolveToolCallConcurrencyStrategy,
} from './tool-call-concurrency';
import type { ToolCallForeachOptions } from './tool-call-concurrency';
import { createToolCallStep } from './tool-call-step';

export const AGENTIC_EXECUTION_WORKFLOW_ID = 'executionWorkflow';

export function createAgenticExecutionWorkflow<Tools extends ToolSet = ToolSet, OUTPUT = undefined>({
  models,
  _internal,
  ...rest
}: OuterLLMRun<Tools, OUTPUT>) {
  const configuredToolCallConcurrency = resolveConfiguredToolCallConcurrency(rest.toolCallConcurrency);
  const toolCallConcurrencyStrategy = resolveToolCallConcurrencyStrategy(rest.toolCallConcurrency);
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

  const signalDrainStep = createSignalDrainStep({
    models,
    _internal,
    ...rest,
  });

  const isTaskCompleteStep = createIsTaskCompleteStep({
    models,
    _internal,
    ...rest,
  });

  const goalStep = createGoalStep({
    models,
    _internal,
    ...rest,
  });

  return createWorkflow({
    id: AGENTIC_EXECUTION_WORKFLOW_ID,
    inputSchema: llmIterationOutputSchema,
    outputSchema: llmIterationOutputSchema,
    options: {
      tracingPolicy: {
        // mark all workflow spans related to the
        // VNext execution as internal
        internal: InternalSpans.WORKFLOW,
      },
      shouldPersistSnapshot: params => {
        // We need a persisted snapshot record to support `resumeStream()`.
        // - Create the initial record early ("pending")
        // - Update it when execution is suspended ("paused"/"suspended")
        // Avoid persisting "running" snapshots so we don't overwrite an existing suspended snapshot.
        return (
          params.workflowStatus === 'pending' ||
          params.workflowStatus === 'paused' ||
          params.workflowStatus === 'suspended'
        );
      },
      // Agent-loop snapshots are pure resume artifacts — strip everything a
      // resume never reads (stale suspend payloads, duplicated message
      // arrays, AI SDK step history) before persisting.
      pruneSnapshot: pruneAgentLoopSnapshot,
      validateInputs: false,
    },
  })
    .then(llmExecutionStep)
    .map(
      async ({ inputData }) => {
        const typedInputData = inputData as LLMIterationData<Tools, OUTPUT>;
        const toolCalls = typedInputData.output.toolCalls || [];
        // Recompute concurrency now that the step's effective active tool set
        // (set by llm-execution-step) and the model's actual tool calls are known.
        //
        // Default (`'available'` strategy): a registered approval/suspending tool
        // that the model did not call this step still forces sequential execution
        // — narrowing to called tool names would incorrectly allow concurrent
        // execution. The `'called'` strategy opts into that narrowing: only tools
        // actually called this step are checked, so a batch of purely safe calls
        // runs concurrently even while an approval/suspend tool stays registered.
        const stepActiveTools = _internal?.stepActiveTools as string[] | undefined;
        const calledToolNames =
          toolCallConcurrencyStrategy === 'called' ? toolCalls.map(toolCall => toolCall.toolName) : undefined;
        toolCallForeachOptions.concurrency = resolveToolCallConcurrency({
          requireToolApproval: rest.requireToolApproval,
          tools: ((_internal?.stepTools as Tools | undefined) ?? rest.tools) as Tools | undefined,
          activeTools: stepActiveTools,
          calledToolNames,
          configuredConcurrency: configuredToolCallConcurrency,
        });
        return toolCalls;
      },
      { id: 'map-tool-calls' },
    )
    .foreach(toolCallStep, toolCallForeachOptions)
    .then(llmMappingStep)
    .then(backgroundTaskCheckStep)
    .then(signalDrainStep)
    .then(isTaskCompleteStep)
    .then(goalStep)
    .commit();
}
