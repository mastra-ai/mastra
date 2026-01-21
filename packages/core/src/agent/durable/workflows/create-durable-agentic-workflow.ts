import { z } from 'zod';
import { createWorkflow } from '../../../workflows';
import type { PubSub } from '../../../events/pubsub';
import { PUBSUB_SYMBOL } from '../../../workflows/constants';
import { ChunkFrom } from '../../../stream/types';
import { DurableStepIds, DurableAgentDefaults } from '../constants';
import { emitStepFinishEvent, emitFinishEvent } from '../stream-adapter';
import type { RunRegistry } from '../run-registry';
import type {
  DurableAgenticWorkflowInput,
  DurableAgenticExecutionOutput,
  DurableLLMStepOutput,
  DurableToolCallInput,
  DurableToolCallOutput,
} from '../types';
import { createDurableLLMExecutionStep, createDurableToolCallStep, createDurableLLMMappingStep } from './steps';

/**
 * Options for creating a durable agentic workflow
 */
export interface DurableAgenticWorkflowOptions {
  /** Run registry for accessing non-serializable state */
  runRegistry: RunRegistry;
  /** Maximum number of agentic loop iterations */
  maxSteps?: number;
}

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
 * Schema for the iteration state that flows through the dowhile loop
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
export function createDurableAgenticWorkflow(options: DurableAgenticWorkflowOptions) {
  const { runRegistry, maxSteps = DurableAgentDefaults.MAX_STEPS } = options;

  // Create the LLM execution step
  const llmExecutionStep = createDurableLLMExecutionStep({ runRegistry });

  // Create the LLM mapping step
  const llmMappingStep = createDurableLLMMappingStep();

  // Create the single iteration workflow (LLM -> Tool Calls -> Mapping)
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
          options: state.options,
          state: state.state,
          messageId: state.messageId,
        };
      },
      { id: 'map-to-llm-input' },
    )
    // Step 1: Execute LLM
    .then(llmExecutionStep)
    // Step 2: Execute tool calls (if any)
    .map(
      async ({ inputData, getInitData }) => {
        const llmOutput = inputData as DurableLLMStepOutput;
        const initData = getInitData() as IterationState;

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

        // Execute tool calls
        // Note: In a full implementation, this would use foreach for parallel execution
        // with proper workflow step execution. For now, execute tools directly.
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

          // Resolve the tool from the registry
          const tools = runRegistry.getTools(initData.runId);
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

          // Execute the tool
          try {
            if (tool.execute) {
              const result = await tool.execute(toolCall.args, {
                toolCallId: toolCall.toolCallId,
                messages: [],
              });
              toolResults.push({
                ...toolCall,
                result,
              });
            } else {
              toolResults.push({
                ...toolCall,
                result: undefined,
              });
            }
          } catch (error) {
            toolResults.push({
              ...toolCall,
              error: {
                name: 'ToolExecutionError',
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
              },
            });
          }
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
      .commit()
  );
}
