import type { ToolSet } from '@internal/ai-sdk-v5';
import { InternalSpans } from '../../../observability';
import { createWorkflow } from '../../../workflows/create';
import { readScoped, writeScoped } from '../../run-scope-access';
import {
  STEP_ACTIVE_TOOLS_KEY,
  STEP_TOOLS_KEY,
  STEP_WORKSPACE_KEY,
  TOOL_APPROVAL_VERDICTS_KEY,
} from '../../run-scope-keys';
import type { OuterLLMRun } from '../../types';
import { pruneAgentLoopSnapshot } from '../prune-snapshot';
import { llmIterationOutputSchema } from '../schema';
import type { LLMIterationData } from '../schema';
import { createBackgroundTaskCheckStep } from './background-task-check-step';
import { EagerToolExecutionCoordinator } from './eager-tool-execution';
import { createGoalStep } from './goal-step';
import { createIsTaskCompleteStep } from './is-task-complete-step';
import { createLLMExecutionStep } from './llm-execution-step';
import { createLLMMappingStep } from './llm-mapping-step';
import { createSignalDrainStep } from './signal-drain-step';
import {
  normalizeToolCallConcurrency,
  resolveEmittedToolCallConcurrency,
  resolveToolCallConcurrency,
} from './tool-call-concurrency';
import type { ToolCallForeachOptions } from './tool-call-concurrency';
import { createToolCallStep } from './tool-call-step';

export const AGENTIC_EXECUTION_WORKFLOW_ID = 'executionWorkflow';

export function createAgenticExecutionWorkflow<Tools extends ToolSet = ToolSet, OUTPUT = undefined>({
  models,
  _internal,
  ...rest
}: OuterLLMRun<Tools, OUTPUT>) {
  const { limit: configuredToolCallConcurrency, strategy: toolCallConcurrencyStrategy } = normalizeToolCallConcurrency(
    rest.toolCallConcurrency,
  );
  const toolCallForeachOptions: ToolCallForeachOptions = {
    // This initial value is a conservative fallback for resume paths that can enter
    // a suspended foreach before llm-execution recomputes the effective step tools.
    // Use the 'available' strategy here regardless of the configured strategy: the
    // called tool set is not known yet, and map-tool-calls narrows it before the
    // foreach actually consumes this value.
    concurrency: resolveToolCallConcurrency({
      requireToolApproval: rest.requireToolApproval,
      tools: rest.tools,
      activeTools: rest.activeTools as string[] | undefined,
      configuredConcurrency: configuredToolCallConcurrency,
    }),
  };

  // Eager dispatch is a regular-streaming-only contract. The 'called' strategy is
  // excluded because its limit depends on the full set of tools the model ends up
  // calling, which is unknowable while the model is still streaming.
  //
  // `Agent.stream()` is where the default lives: it resolves the option to a boolean
  // before the options reach here, so an eligible call — a plain server-side call with
  // complete arguments — runs early unless the caller passed `eagerToolExecution: false`.
  //
  // The check is `=== true` rather than "not false" on purpose. Durable agents run their
  // own mirrored steps and never build this workflow, and durable preparation rejects an
  // explicit `true` outright; requiring the flag to be present makes that exclusion a
  // stated condition rather than a consequence of the option not being threaded through.
  // The same goes for any other caller reaching the loop directly.
  const eagerCoordinator =
    rest.eagerToolExecution === true && rest.methodType === 'stream' && toolCallConcurrencyStrategy === 'available'
      ? // Read the limit late: map-tool-calls recomputes it per step, and the eager
        // path must honour the same recomputed value rather than a construction-time copy.
        new EagerToolExecutionCoordinator(() => toolCallForeachOptions.concurrency)
      : undefined;

  const toolCallStep = createToolCallStep({
    models,
    _internal,
    ...rest,
  });

  const llmExecutionStep = createLLMExecutionStep({
    models,
    _internal,
    toolCallForeachOptions,
    eagerCoordinator,
    eagerToolCallStep: toolCallStep,
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
      // Excluding `running` means resume claims cannot persist; the agent loop
      // serializes its own resumes, so suppress the per-resume warning.
      allowUnclaimedResumes: true,
      // Agent-loop snapshots are pure resume artifacts — strip everything a
      // resume never reads (stale suspend payloads, duplicated message
      // arrays, AI SDK step history) before persisting.
      pruneSnapshot: pruneAgentLoopSnapshot,
      validateInputs: false,
    },
  })
    .then(llmExecutionStep)
    .map(
      async ({ inputData, requestContext }) => {
        const typedInputData = inputData as LLMIterationData<Tools, OUTPUT>;
        const toolCalls = typedInputData.output.toolCalls || [];
        // Recompute concurrency now that the model has emitted its tool calls.
        //
        // Function approval policies (run-wide `requireToolApproval` or a tool's
        // `needsApprovalFn`, e.g. MCP tools) are evaluated with each emitted call's args,
        // so a policy returning false does not serialize. Called tools that need approval
        // or can suspend still serialize.
        //
        // Default ('available') strategy: a static approval flag or suspend schema on any
        // active tool still forces sequential execution, even if the model did not call it.
        // Opt-in ('called') strategy: only the tools the model actually called count.
        //
        // Read step tools through the run scope like toolCallStep does: on resume, `_internal`
        // is rebuilt without them while the scope still holds the suspended step's values.
        const scopeCtx = { mastra: rest.mastra, runId: rest.runId, _internal };
        const stepActiveTools = readScoped(scopeCtx, STEP_ACTIVE_TOOLS_KEY, 'stepActiveTools');
        // Cache each verdict so toolCallStep applies the exact scheduling decision without
        // evaluating a potentially stateful policy a second time.
        const approvalVerdicts = new Map<string, boolean>();
        toolCallForeachOptions.concurrency = await resolveEmittedToolCallConcurrency({
          requireToolApproval: rest.requireToolApproval ?? requestContext?.get('__mastra_requireToolApproval'),
          tools: (readScoped(scopeCtx, STEP_TOOLS_KEY, 'stepTools') as Tools | undefined) ?? rest.tools,
          activeTools: stepActiveTools,
          configuredConcurrency: configuredToolCallConcurrency,
          strategy: toolCallConcurrencyStrategy,
          toolCalls,
          approvalVerdicts,
          requestContext,
          workspace: readScoped(scopeCtx, STEP_WORKSPACE_KEY, 'stepWorkspace'),
          logger: rest.logger,
        });
        writeScoped(scopeCtx, TOOL_APPROVAL_VERDICTS_KEY, 'toolApprovalVerdicts', approvalVerdicts);
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
