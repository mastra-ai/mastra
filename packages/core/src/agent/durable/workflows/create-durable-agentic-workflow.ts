import { z } from 'zod';
import type { MastraScorer, MastraScorerEntry } from '../../../evals/base';
import { runScorer } from '../../../evals/hooks';
import type { PubSub } from '../../../events/pubsub';
import type { Mastra } from '../../../mastra';
import { RequestContext } from '../../../request-context';
import { createWorkflow } from '../../../workflows';
import { PUBSUB_SYMBOL } from '../../../workflows/constants';
import { MessageList } from '../../message-list';
import { DurableStepIds, DurableAgentDefaults } from '../constants';
import { emitFinishEvent } from '../stream-adapter';
import type {
  DurableToolCallInput,
  DurableAgenticWorkflowInput,
  DurableAgenticExecutionOutput,
  DurableLLMStepOutput,
  DurableToolCallOutput,
  SerializableScorersConfig,
} from '../types';
import {
  modelConfigSchema,
  modelListEntrySchema,
  durableAgenticOutputSchema,
  baseIterationStateSchema,
  createBaseIterationStateUpdate,
} from './shared';
import { createDurableLLMExecutionStep, createDurableToolCallStep, createDurableLLMMappingStep } from './steps';

/**
 * Options for creating a durable agentic workflow
 */
export interface DurableAgenticWorkflowOptions {
  /** Maximum number of agentic loop iterations */
  maxSteps?: number;
}

/**
 * Input schema for the durable agentic workflow.
 * Extends base schema with model list for fallback support.
 */
const durableAgenticInputSchema = z.object({
  __workflowKind: z.literal('durable-agent'),
  runId: z.string(),
  agentId: z.string(),
  agentName: z.string().optional(),
  messageListState: z.any(),
  toolsMetadata: z.array(z.any()),
  modelConfig: modelConfigSchema,
  // Model list for fallback support (when agent configured with array of models)
  modelList: z.array(modelListEntrySchema).optional(),
  options: z.any(),
  state: z.any(),
  messageId: z.string(),
});

// Re-export shared output schema (identical across implementations)
// Note: durableAgenticOutputSchema is imported from shared

/**
 * Schema for the iteration state that flows through the dowhile loop.
 * Extends base schema with model list for fallback support.
 */
const iterationStateSchema = baseIterationStateSchema.extend({
  // Model list for fallback support
  modelList: z.array(z.any()).optional(),
});

type IterationState = z.infer<typeof iterationStateSchema>;

/**
 * Create a durable agentic workflow.
 *
 * This workflow implements the agentic loop pattern in a durable way:
 *
 * 1. LLM Execution Step - Calls the LLM and gets response/tool calls
 * 2. Tool Call Steps (foreach) - Executes each tool call in parallel
 * 3. LLM Mapping Step - Merges tool results back into state
 * 4. Loop - Continues if more tool calls are needed (dowhile)
 *
 * All state flows through workflow input/output, making it durable across
 * process restarts and execution engine replays.
 */
export function createDurableAgenticWorkflow(options?: DurableAgenticWorkflowOptions) {
  const maxSteps = options?.maxSteps ?? DurableAgentDefaults.MAX_STEPS;

  // Create the LLM execution step - tools and model are resolved from Mastra at runtime
  const llmExecutionStep = createDurableLLMExecutionStep();

  // Create the tool call step - each tool call runs as its own step with suspend support
  const toolCallStep = createDurableToolCallStep();

  // Create the LLM mapping step
  const llmMappingStep = createDurableLLMMappingStep();

  // Create the single iteration workflow (LLM -> Tool Calls -> Mapping)
  // Note: foreach runs with concurrency: 1 (sequential) because tool approval
  // and suspension require sequential execution to properly handle suspend/resume.
  // The workflow is created once at startup and reused for all runs.
  const singleIterationWorkflow = createWorkflow({
    id: DurableStepIds.AGENTIC_EXECUTION,
    inputSchema: iterationStateSchema,
    outputSchema: iterationStateSchema,
    options: {
      shouldPersistSnapshot: ({ workflowStatus }) => workflowStatus === 'suspended',
      validateInputs: false,
    },
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
          modelList: state.modelList,
          options: state.options,
          state: state.state,
          messageId: state.messageId,
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
    .foreach(toolCallStep)
    // Step 4: Collect tool results and bundle with LLM output for mapping step
    .map(
      async ({ inputData, getStepResult, getInitData }) => {
        const toolResults = inputData as DurableToolCallOutput[];
        const llmOutput = getStepResult(llmExecutionStep.id) as DurableLLMStepOutput;
        const initData = getInitData() as IterationState;

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

        // Extend with core-specific fields
        const newIterationState: IterationState = {
          ...baseUpdate,
          modelList: initData.modelList,
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
        shouldPersistSnapshot: ({ workflowStatus }) => workflowStatus === 'suspended',
        validateInputs: false,
      },
    })
      // Initialize iteration state from input
      .map(
        async ({ inputData }) => {
          const input = inputData as DurableAgenticWorkflowInput;
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
        const underMaxSteps = state.iterationCount < maxSteps;

        return shouldContinue && underMaxSteps;
      })
      // Map final state to output format and emit finish event
      .map(
        async params => {
          const { inputData } = params;
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
      // Execute scorers (fire-and-forget, doesn't affect main result)
      .map(
        async params => {
          const { inputData, getInitData, mastra, requestContext, tracingContext } = params;
          const finalOutput = inputData;
          const initData = getInitData() as DurableAgenticWorkflowInput;

          // If no scorers configured, skip
          const scorers = initData.scorers as SerializableScorersConfig | undefined;
          if (!scorers || Object.keys(scorers).length === 0) {
            return finalOutput;
          }

          const logger = mastra?.getLogger?.();

          // Reconstruct input MessageList to extract scorer input
          const inputMessageList = new MessageList();
          inputMessageList.deserialize(initData.messageListState);

          // Build scorer input (messages before generation)
          const scorerInput = {
            inputMessages: inputMessageList.getPersisted.input.db(),
            rememberedMessages: inputMessageList.getPersisted.remembered.db(),
            systemMessages: inputMessageList.getSystemMessages(),
            taggedSystemMessages: inputMessageList.getPersisted.taggedSystemMessages,
          };

          // Reconstruct output MessageList to extract scorer output
          const outputMessageList = new MessageList();
          outputMessageList.deserialize(finalOutput.messageListState);
          const scorerOutput = outputMessageList.getPersisted.response.db();

          // Create request context for scorer resolution
          const resolveContext = requestContext ?? new RequestContext();

          // Execute each scorer (fire-and-forget)
          for (const [scorerKey, scorerEntry] of Object.entries(scorers)) {
            const { scorerName, sampling } = scorerEntry;

            try {
              // Resolve the scorer from Mastra
              const scorer = (mastra as Mastra)?.getScorer?.(scorerName) as MastraScorer | undefined;

              if (!scorer) {
                logger?.warn?.(`Scorer ${scorerName} not found in Mastra, skipping`, {
                  runId: initData.runId,
                  scorerKey,
                });
                continue;
              }

              // Create the scorer entry expected by runScorer
              const scorerObject: MastraScorerEntry = {
                scorer,
                sampling,
              };

              // Call runScorer (fire-and-forget via hooks)
              runScorer({
                runId: initData.runId,
                scorerId: scorerKey,
                scorerObject,
                input: scorerInput,
                output: scorerOutput,
                requestContext: resolveContext as any,
                entity: {
                  id: initData.agentId,
                  name: initData.agentName ?? initData.agentId,
                },
                structuredOutput: false,
                source: 'LIVE',
                entityType: 'AGENT',
                threadId: initData.state?.threadId,
                resourceId: initData.state?.resourceId,
                tracingContext,
              });
            } catch (error) {
              // Log but don't fail - scorer errors shouldn't affect main execution
              logger?.warn?.(`Error executing scorer ${scorerName}`, {
                error,
                runId: initData.runId,
                scorerKey,
              });
            }
          }

          return finalOutput;
        },
        { id: 'execute-scorers' },
      )
      .commit()
  );
}
