import {
  createDurableLLMExecutionStep,
  createDurableLLMMappingStep,
  DurableAgentDefaults,
  DurableStepIds,
  emitFinishEvent,
  emitChunkEvent,
} from '@mastra/core/agent/durable';
import type {
  DurableAgenticExecutionOutput,
  DurableAgenticWorkflowInput,
  DurableLLMStepOutput,
  DurableToolCallOutput,
} from '@mastra/core/agent/durable';
import type { PubSub } from '@mastra/core/events';
import type { Mastra } from '@mastra/core/mastra';
import { SpanType, EntityType, InternalSpans } from '@mastra/core/observability';
import type { ExportedSpan } from '@mastra/core/observability';
import { ChunkFrom } from '@mastra/core/stream';
import { PUBSUB_SYMBOL } from '@mastra/core/workflows/_constants';
import type { Inngest } from 'inngest';
import { z } from 'zod';

import { init } from '../index';

/**
 * Input schema for the durable agentic workflow
 */
const durableAgenticInputSchema = z.object({
  runId: z.string(),
  agentId: z.string(),
  agentName: z.string().optional(),
  messageListState: z.any(),
  toolsMetadata: z.array(z.any()),
  modelConfig: z.object({
    provider: z.string(),
    modelId: z.string(),
    specificationVersion: z.string().optional(),
    settings: z.record(z.any()).optional(),
  }),
  options: z.any(),
  state: z.any(),
  messageId: z.string(),
  agentSpanData: z.any().optional(),
  // Model span data (ONE span for entire agent run, created before workflow)
  modelSpanData: z.any().optional(),
  // Starting step index for continuation
  stepIndex: z.number().optional(),
});

/**
 * Output schema for the durable agentic workflow
 */
const durableAgenticOutputSchema = z.object({
  messageListState: z.any(),
  messageId: z.string(),
  stepResult: z.any(),
  output: z.object({
    text: z.string().optional(),
    usage: z.any(),
    steps: z.array(z.any()),
  }),
  state: z.any(),
});

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
 */
const iterationStateSchema = z.object({
  // Original input fields
  runId: z.string(),
  agentId: z.string(),
  agentName: z.string().optional(),
  messageListState: z.any(),
  toolsMetadata: z.array(z.any()),
  modelConfig: z.any(),
  options: z.any(),
  state: z.any(),
  messageId: z.string(),
  // Iteration tracking
  iterationCount: z.number(),
  accumulatedSteps: z.array(z.any()),
  accumulatedUsage: z.object({
    inputTokens: z.number(),
    outputTokens: z.number(),
    totalTokens: z.number(),
  }),
  // Last step result for continuation check
  lastStepResult: z.any().optional(),
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
 * 2. Tool Call Execution - Executes each tool call
 * 3. LLM Mapping Step - Merges tool results back into state
 * 4. Loop - Continues if more tool calls are needed (dowhile)
 *
 * All state flows through workflow input/output, making it durable across
 * process restarts and execution engine replays.
 *
 * @param options - Configuration options
 * @returns An InngestWorkflow instance that implements the agentic loop
 */
export function createInngestDurableAgenticWorkflow(options: InngestDurableAgenticWorkflowOptions) {
  const { inngest, maxSteps = DurableAgentDefaults.MAX_STEPS } = options;
  const { createWorkflow } = init(inngest);

  // Create the LLM execution step - tools and model are resolved from Mastra at runtime
  const llmExecutionStep = createDurableLLMExecutionStep();

  // Create the LLM mapping step - reuse from core
  const llmMappingStep = createDurableLLMMappingStep();

  // Create the single iteration workflow (LLM -> Tool Calls -> Mapping)
  const singleIterationWorkflow = createWorkflow({
    id: DurableStepIds.AGENTIC_EXECUTION,
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
    // Step 2: Execute tool calls (if any)
    .map(
      async params => {
        const { inputData, getInitData, mastra } = params;
        const llmOutput = inputData as DurableLLMStepOutput;
        const initData = getInitData() as IterationState;

        // Access pubsub via symbol for emitting tool-result chunks
        const pubsub = (params as any)[PUBSUB_SYMBOL] as PubSub | undefined;

        // If no tool calls, skip to mapping
        if (!llmOutput.toolCalls || llmOutput.toolCalls.length === 0) {
          return {
            llmOutput,
            toolResults: [] as DurableToolCallOutput[],
            runId: initData.runId,
            agentId: initData.agentId,
            messageId: initData.messageId,
            state: llmOutput.state,
          };
        }

        // Get tools from the agent via Mastra
        let tools: Record<string, any> = {};
        if (mastra) {
          try {
            const agent = (mastra as Mastra).getAgentById(initData.agentId);
            tools = await agent.getToolsForExecution({
              runId: initData.runId,
              threadId: initData.state?.threadId,
              resourceId: initData.state?.resourceId,
              memoryConfig: initData.state?.memoryConfig,
              autoResumeSuspendedTools: initData.options?.autoResumeSuspendedTools,
            });
          } catch (error) {
            mastra?.getLogger?.()?.debug?.(`Failed to get tools from agent: ${error}`);
          }
        }

        // Get observability for tool call spans
        const observability = mastra?.observability?.getSelectedInstance({});

        // Rebuild spans from exported data:
        // - stepSpan: parent for tool and tool-result (matches regular agent structure)
        // - modelSpan: parent of stepSpan, close after stepSpan
        // - agentSpan: fallback if others not available
        const modelSpanData = (llmOutput as any).modelSpanData as ExportedSpan<SpanType.MODEL_GENERATION> | undefined;
        const stepSpanData = (llmOutput as any).stepSpanData as ExportedSpan<SpanType.MODEL_STEP> | undefined;

        const modelSpan = modelSpanData ? observability?.rebuildSpan(modelSpanData) : undefined;
        const stepSpan = stepSpanData ? observability?.rebuildSpan(stepSpanData) : undefined;
        const agentSpan = initData.agentSpanData ? observability?.rebuildSpan(initData.agentSpanData) : undefined;

        // Tool spans should be children of model_step (like regular agent)
        const toolParentSpan = stepSpan ?? modelSpan ?? agentSpan;

        // Execute tool calls
        const toolResults: DurableToolCallOutput[] = [];

        for (const toolCall of llmOutput.toolCalls) {
          // If tool was already executed by provider, use that result
          if (toolCall.providerExecuted && toolCall.output !== undefined) {
            toolResults.push({
              ...toolCall,
              result: toolCall.output,
            });
            continue;
          }

          // Resolve the tool
          const tool = tools[toolCall.toolName];

          if (!tool) {
            toolResults.push({
              ...toolCall,
              error: {
                name: 'ToolNotFoundError',
                message: `Tool ${toolCall.toolName} not found`,
              },
            });
            continue;
          }

          // Create TOOL_CALL span for observability
          // Use model span as parent so tools are nested under model_generation (like regular agents)
          const toolSpan = toolParentSpan?.createChildSpan({
            type: SpanType.TOOL_CALL,
            name: `tool: '${toolCall.toolName}'`,
            entityType: EntityType.TOOL,
            entityId: toolCall.toolName,
            entityName: toolCall.toolName,
            input: toolCall.args,
          });

          // Execute the tool
          try {
            if (tool.execute) {
              const result = await tool.execute(toolCall.args, {
                toolCallId: toolCall.toolCallId,
                messages: [],
              });
              toolSpan?.end({ output: result });
              const toolResult: DurableToolCallOutput = {
                ...toolCall,
                result,
              };
              toolResults.push(toolResult);

              // Create tool-result chunk span as child of model_step (like regular agent)
              stepSpan?.createEventSpan({
                type: SpanType.MODEL_CHUNK,
                name: `chunk: 'tool-result'`,
                output: {
                  toolCallId: toolCall.toolCallId,
                  toolName: toolCall.toolName,
                  result,
                },
              });

              // Emit tool-result chunk so client stream receives it
              if (pubsub) {
                await emitChunkEvent(pubsub, initData.runId, {
                  type: 'tool-result',
                  runId: initData.runId,
                  from: ChunkFrom.AGENT,
                  payload: {
                    toolCallId: toolCall.toolCallId,
                    toolName: toolCall.toolName,
                    args: toolCall.args,
                    result,
                  },
                });
              }
            } else {
              toolSpan?.end({ output: undefined });
              toolResults.push({
                ...toolCall,
                result: undefined,
              });
            }
          } catch (error) {
            toolSpan?.error({
              error: error instanceof Error ? error : new Error(String(error)),
            });
            const toolError = {
              name: 'ToolExecutionError',
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
            };
            toolResults.push({
              ...toolCall,
              error: toolError,
            });

            // Emit tool-error chunk so client stream receives it
            if (pubsub) {
              await emitChunkEvent(pubsub, initData.runId, {
                type: 'tool-error',
                runId: initData.runId,
                from: ChunkFrom.AGENT,
                payload: {
                  toolCallId: toolCall.toolCallId,
                  toolName: toolCall.toolName,
                  args: toolCall.args,
                  error: toolError,
                },
              });
            }
          }
        }

        // End step span (children before parent)
        // Use the pending step finish payload from LLM execution for proper attributes
        // NOTE: We do NOT close the model span here - it stays open for the entire agent run
        // and is closed in map-final-output after the agentic loop completes
        if (stepSpan) {
          const stepFinishPayload = (llmOutput as any).stepFinishPayload as any;
          stepSpan.end({
            output: {
              toolCalls: llmOutput.toolCalls.map(tc => ({
                toolCallId: tc.toolCallId,
                toolName: tc.toolName,
                args: tc.args,
              })),
              toolResults: toolResults.map(tr => ({
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
          state: llmOutput.state,
        };
      },
      { id: 'execute-tool-calls' },
    )
    // Step 3: Map tool results back to state
    .then(llmMappingStep)
    // Step 4: Map back to iteration state format
    .map(
      async ({ inputData, getInitData }) => {
        const executionOutput = inputData as DurableAgenticExecutionOutput;
        const initData = getInitData() as IterationState;

        // Accumulate usage
        const newUsage = {
          inputTokens: initData.accumulatedUsage.inputTokens + (executionOutput.output.usage?.inputTokens || 0),
          outputTokens: initData.accumulatedUsage.outputTokens + (executionOutput.output.usage?.outputTokens || 0),
          totalTokens: initData.accumulatedUsage.totalTokens + (executionOutput.output.usage?.totalTokens || 0),
        };

        // Build step record
        const stepRecord = {
          text: executionOutput.output.text,
          toolCalls: executionOutput.output.toolCalls,
          toolResults: executionOutput.toolResults,
          usage: executionOutput.output.usage,
          finishReason: executionOutput.stepResult.reason,
        };

        const newIterationState: IterationState = {
          runId: initData.runId,
          agentId: initData.agentId,
          agentName: initData.agentName,
          messageListState: executionOutput.messageListState,
          toolsMetadata: initData.toolsMetadata,
          modelConfig: initData.modelConfig,
          options: initData.options,
          state: executionOutput.state,
          messageId: executionOutput.messageId,
          iterationCount: initData.iterationCount + 1,
          accumulatedSteps: [...initData.accumulatedSteps, stepRecord],
          accumulatedUsage: newUsage,
          lastStepResult: executionOutput.stepResult,
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
      id: DurableStepIds.AGENTIC_LOOP,
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
