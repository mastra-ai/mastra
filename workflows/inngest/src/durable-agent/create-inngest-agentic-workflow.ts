import {
  createDurableLLMExecutionStep,
  createDurableLLMMappingStep,
  createDurableToolCallStep,
  DurableAgentDefaults,
  DurableStepIds,
  emitFinishEvent,
  modelConfigSchema,
  durableAgenticOutputSchema,
  baseIterationStateSchema,
  createBaseIterationStateUpdate,
} from '@mastra/core/agent/durable';
import type {
  DurableAgenticExecutionOutput,
  DurableAgenticWorkflowInput,
  DurableLLMStepOutput,
  DurableToolCallOutput,
  DurableToolCallInput,
} from '@mastra/core/agent/durable';
import type { PubSub } from '@mastra/core/events';
import { SpanType, EntityType, InternalSpans } from '@mastra/core/observability';
import type { ExportedSpan } from '@mastra/core/observability';
import { PUBSUB_SYMBOL } from '@mastra/core/workflows/_constants';
import type { Inngest } from 'inngest';
import { z } from 'zod';

import { init } from '../index';

/**
 * Input schema for the durable agentic workflow.
 * Extends base with observability fields for Inngest.
 */
const durableAgenticInputSchema = z.object({
  runId: z.string(),
  agentId: z.string(),
  agentName: z.string().optional(),
  messageListState: z.any(),
  toolsMetadata: z.array(z.any()),
  modelConfig: modelConfigSchema,
  options: z.any(),
  state: z.any(),
  messageId: z.string(),
  // Observability fields (Inngest-specific)
  agentSpanData: z.any().optional(),
  modelSpanData: z.any().optional(),
  stepIndex: z.number().optional(),
});

// Output schema imported from shared (durableAgenticOutputSchema)

/**
 * Options for creating an Inngest durable agentic workflow
 */
export interface InngestDurableAgenticWorkflowOptions {
  /** Inngest client instance */
  inngest: Inngest;
  /** Maximum number of agentic loop iterations */
  maxSteps?: number;
}

/**
 * Iteration state schema - extends base with observability fields.
 */
const iterationStateSchema = baseIterationStateSchema.extend({
  // Observability - exported span data for agent run
  agentSpanData: z.any().optional(),
  // Observability - exported span data for model generation (ONE span for entire run)
  modelSpanData: z.any().optional(),
  // Step index for continuation across iterations (maintains step: 0, 1, 2, ...)
  stepIndex: z.number(),
});

type IterationState = z.infer<typeof iterationStateSchema> & {
  agentSpanData?: ExportedSpan<SpanType.AGENT_RUN>;
  modelSpanData?: ExportedSpan<SpanType.MODEL_GENERATION>;
};

/**
 * Create a durable agentic workflow using Inngest.
 *
 * This workflow implements the agentic loop pattern in a durable way using
 * Inngest's execution engine:
 *
 * 1. LLM Execution Step - Calls the LLM and gets response/tool calls
 * 2. Tool Call Steps (foreach) - Executes each tool call individually with suspend support
 * 3. LLM Mapping Step - Merges tool results back into state
 * 4. Loop - Continues if more tool calls are needed (dowhile)
 *
 * All state flows through workflow input/output, making it durable across
 * process restarts and execution engine replays.
 *
 * @param options - Configuration options
 * @returns An InngestWorkflow instance that implements the agentic loop
 */
/** Prefix for Inngest engine workflow IDs to avoid collision with other engines */
const INNGEST_ENGINE_PREFIX = 'inngest';

/** Inngest-prefixed workflow IDs */
export const InngestDurableStepIds = {
  AGENTIC_EXECUTION: `${INNGEST_ENGINE_PREFIX}:${DurableStepIds.AGENTIC_EXECUTION}`,
  AGENTIC_LOOP: `${INNGEST_ENGINE_PREFIX}:${DurableStepIds.AGENTIC_LOOP}`,
} as const;

export function createInngestDurableAgenticWorkflow(options: InngestDurableAgenticWorkflowOptions) {
  const { inngest, maxSteps = DurableAgentDefaults.MAX_STEPS } = options;
  const { createWorkflow } = init(inngest);

  // Create the LLM execution step - tools and model are resolved from Mastra at runtime
  const llmExecutionStep = createDurableLLMExecutionStep();

  // Create the tool call step - each tool call runs as its own step with suspend support
  const toolCallStep = createDurableToolCallStep();

  // Create the LLM mapping step - reuse from core
  const llmMappingStep = createDurableLLMMappingStep();

  // Create the single iteration workflow (LLM -> Tool Calls -> Mapping)
  const singleIterationWorkflow = createWorkflow({
    id: InngestDurableStepIds.AGENTIC_EXECUTION,
    inputSchema: iterationStateSchema,
    outputSchema: iterationStateSchema,
    options: {
      tracingPolicy: {
        // Mark all workflow spans as internal so they're hidden in traces
        // This makes the trace structure match regular agents (agent_run -> model_generation -> tool_call)
        internal: InternalSpans.WORKFLOW,
      },
      shouldPersistSnapshot: ({ workflowStatus }) => workflowStatus === 'suspended',
      validateInputs: false,
    },
    steps: [],
  })
    // Step 0: Convert iteration state to LLM input format
    .map(
      async ({ inputData }) => {
        const state = inputData as IterationState;
        return {
          runId: state.runId,
          agentId: state.agentId,
          agentName: state.agentName,
          messageListState: state.messageListState,
          toolsMetadata: state.toolsMetadata,
          modelConfig: state.modelConfig,
          options: state.options,
          state: state.state,
          messageId: state.messageId,
          // Pass agent span data so model spans can use it as parent
          agentSpanData: state.agentSpanData,
          // Pass model span data (ONE span for entire agent run)
          modelSpanData: state.modelSpanData,
          // Pass step index for continuation (step: 0, 1, 2, ...)
          stepIndex: state.stepIndex,
        };
      },
      { id: 'map-to-llm-input' },
    )
    // Step 1: Execute LLM
    .then(llmExecutionStep)
    // Step 2: Extract tool calls as array for foreach
    .map(
      async ({ inputData }) => {
        const llmOutput = inputData as DurableLLMStepOutput;
        return (llmOutput.toolCalls ?? []) as DurableToolCallInput[];
      },
      { id: 'extract-tool-calls' },
    )
    // Step 3: Execute each tool call individually (with suspend support)
    // Tool result/error PubSub emission is handled by createDurableToolCallStep
    .foreach(toolCallStep)
    // Step 4: Collect tool results, create observability spans, and bundle for mapping
    .map(
      async ({ inputData, getStepResult, getInitData, mastra }) => {
        const toolResults = inputData as DurableToolCallOutput[];
        const llmOutput = getStepResult(llmExecutionStep.id) as DurableLLMStepOutput;
        const initData = getInitData() as IterationState;

        // Create observability spans retroactively for each tool result
        // In the foreach pattern, individual tool calls don't have access to
        // the observability context, so we create spans here in the collection step
        const observability = mastra?.observability?.getSelectedInstance({});

        const modelSpanData = (llmOutput as any)?.modelSpanData as ExportedSpan<SpanType.MODEL_GENERATION> | undefined;
        const stepSpanData = (llmOutput as any)?.stepSpanData as ExportedSpan<SpanType.MODEL_STEP> | undefined;

        const modelSpan = modelSpanData ? observability?.rebuildSpan(modelSpanData) : undefined;
        const stepSpan = stepSpanData ? observability?.rebuildSpan(stepSpanData) : undefined;
        const agentSpan = initData.agentSpanData ? observability?.rebuildSpan(initData.agentSpanData) : undefined;
        const toolParentSpan = stepSpan ?? modelSpan ?? agentSpan;

        // Create tool call + tool result spans for each tool result
        for (const tr of toolResults) {
          const toolSpan = toolParentSpan?.createChildSpan({
            type: SpanType.TOOL_CALL,
            name: `tool: '${tr.toolName}'`,
            entityType: EntityType.TOOL,
            entityId: tr.toolName,
            entityName: tr.toolName,
            input: tr.args,
          });

          if (tr.error) {
            toolSpan?.error({ error: new Error(tr.error.message) });
          } else {
            toolSpan?.end({ output: tr.result });
          }

          // Create tool-result chunk span as child of model_step
          if (!tr.error) {
            stepSpan?.createEventSpan({
              type: SpanType.MODEL_CHUNK,
              name: `chunk: 'tool-result'`,
              output: {
                toolCallId: tr.toolCallId,
                toolName: tr.toolName,
                result: tr.result,
              },
            });
          }
        }

        // End step span (children before parent)
        // NOTE: We do NOT close the model span here - it stays open for the entire agent run
        // and is closed in map-final-output after the agentic loop completes
        const toolCalls = (llmOutput?.toolCalls ?? []) as DurableToolCallInput[];
        if (stepSpan) {
          const stepFinishPayload = (llmOutput as any).stepFinishPayload as any;
          stepSpan.end({
            output: {
              toolCalls: toolCalls.map(tc => ({
                toolCallId: tc.toolCallId,
                toolName: tc.toolName,
                args: tc.args,
              })),
              toolResults: toolResults.map((tr: DurableToolCallOutput) => ({
                toolCallId: tr.toolCallId,
                toolName: tr.toolName,
                result: tr.result,
                error: tr.error,
              })),
            },
            attributes: {
              usage: stepFinishPayload?.output?.usage,
              finishReason: stepFinishPayload?.stepResult?.reason,
              isContinued: stepFinishPayload?.stepResult?.isContinued,
            },
          });
        }

        return {
          llmOutput,
          toolResults,
          runId: initData.runId,
          agentId: initData.agentId,
          messageId: initData.messageId,
          state: llmOutput?.state ?? initData.state,
        };
      },
      { id: 'collect-tool-results' },
    )
    // Step 5: Map tool results back to state
    .then(llmMappingStep)
    // Step 6: Map back to iteration state format using shared function
    .map(
      async ({ inputData, getInitData }) => {
        const executionOutput = inputData as DurableAgenticExecutionOutput;
        const initData = getInitData() as IterationState;

        // Use shared function for base state update
        const baseUpdate = createBaseIterationStateUpdate({
          currentState: initData,
          executionOutput,
        });

        // Extend with Inngest-specific observability fields
        const newIterationState: IterationState = {
          ...baseUpdate,
          // Preserve agent span data for observability
          agentSpanData: initData.agentSpanData,
          // Preserve model span data (ONE span for entire agent run)
          modelSpanData: initData.modelSpanData,
          // Increment step index for next iteration (step: 0 → 1 → 2 → ...)
          stepIndex: initData.stepIndex + 1,
        };

        return newIterationState;
      },
      { id: 'update-iteration-state' },
    )
    .commit();

  // Create the main agentic loop workflow with dowhile
  return (
    createWorkflow({
      id: InngestDurableStepIds.AGENTIC_LOOP,
      inputSchema: durableAgenticInputSchema,
      outputSchema: durableAgenticOutputSchema,
      options: {
        tracingPolicy: {
          // Mark all workflow spans as internal so they're hidden in traces
          // This makes the trace structure match regular agents (agent_run -> model_generation -> tool_call)
          internal: InternalSpans.WORKFLOW,
        },
        shouldPersistSnapshot: ({ workflowStatus }) => workflowStatus === 'suspended',
        validateInputs: false,
      },
      steps: [],
    })
      // Initialize iteration state from input
      // The AGENT_RUN span is created BEFORE the workflow starts (in InngestAgent.stream)
      // and passed via input.agentSpanData so the agent_run is the root of the trace
      .map(
        async ({ inputData }) => {
          const input = inputData as DurableAgenticWorkflowInput;

          // Use the agent span data passed from InngestAgent.stream()
          // This span was created before the workflow started, making it the trace root
          const agentSpanData = input.agentSpanData as ExportedSpan<SpanType.AGENT_RUN> | undefined;
          // Use the model span data passed from InngestAgent.stream()
          // This ensures ONE model_generation span contains all steps (like regular agents)
          const modelSpanData = input.modelSpanData as ExportedSpan<SpanType.MODEL_GENERATION> | undefined;

          const iterationState: IterationState = {
            ...input,
            iterationCount: 0,
            accumulatedSteps: [],
            accumulatedUsage: {
              inputTokens: 0,
              outputTokens: 0,
              totalTokens: 0,
            },
            lastStepResult: undefined,
            agentSpanData,
            modelSpanData,
            stepIndex: input.stepIndex ?? 0,
          };
          return iterationState;
        },
        { id: 'init-iteration-state' },
      )
      // Run the agentic loop with dowhile
      .dowhile(singleIterationWorkflow, async ({ inputData }) => {
        const state = inputData as IterationState;

        // Check if we should continue
        const shouldContinue = state.lastStepResult?.isContinued === true;
        // Use maxSteps from options (per-request), falling back to workflow-level default
        const effectiveMaxSteps = state.options?.maxSteps ?? maxSteps;
        const underMaxSteps = state.iterationCount < effectiveMaxSteps;

        return shouldContinue && underMaxSteps;
      })
      // Map final state to output format, close agent span, and emit finish event
      .map(
        async params => {
          const { inputData, mastra } = params;
          const state = inputData as IterationState;

          // Access pubsub via symbol to emit finish event
          const pubsub = (params as any)[PUBSUB_SYMBOL] as PubSub | undefined;

          // Extract final text from last step
          const lastStep = state.accumulatedSteps[state.accumulatedSteps.length - 1];
          const finalText = lastStep?.text;

          const finalOutput = {
            messageListState: state.messageListState,
            messageId: state.messageId,
            stepResult: state.lastStepResult || {
              reason: 'stop',
              warnings: [],
              isContinued: false,
            },
            output: {
              text: finalText,
              usage: state.accumulatedUsage,
              steps: state.accumulatedSteps,
            },
            state: state.state,
          };

          // End MODEL_GENERATION span with final output (children before parent)
          // This span was created BEFORE the workflow started and stayed open for all iterations
          const observability = mastra?.observability?.getSelectedInstance({});
          if (state.modelSpanData) {
            const modelSpan = observability?.rebuildSpan(state.modelSpanData);
            modelSpan?.end({
              output: {
                text: finalText,
                usage: state.accumulatedUsage,
              },
              attributes: {
                finishReason: state.lastStepResult?.reason || 'stop',
              },
            });
          }

          // End AGENT_RUN span with final output
          if (state.agentSpanData) {
            const agentSpan = observability?.rebuildSpan(state.agentSpanData);
            agentSpan?.end({
              output: finalOutput.output,
            });
          }

          // Emit finish event via pubsub
          if (pubsub) {
            await emitFinishEvent(pubsub, state.runId, {
              output: finalOutput.output,
              stepResult: finalOutput.stepResult,
            });
          }

          return finalOutput;
        },
        { id: 'map-final-output' },
      )
      .commit()
  );
}
