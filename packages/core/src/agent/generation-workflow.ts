import { randomUUID } from 'crypto';
import type {
  GenerateObjectResult,
  GenerateTextResult,
  CoreMessage,
} from 'ai';
import type { JSONSchema7 } from 'json-schema';
import { z } from 'zod';
import type { ZodSchema } from 'zod';
import { RuntimeContext } from '../runtime-context';
import { createStep, createWorkflow } from '../workflows';
import { SaveQueueManager } from './save-queue';
import type { AgentGenerateOptions, AiMessageType } from './types';

type IDGenerator = () => string;

// Helper to resolve threadId from args (supports both new and old API)
function resolveThreadIdFromArgs(args: {
  memory?: any;
  threadId?: string;
}): (Partial<any> & { id: string }) | undefined {
  if (args?.memory?.thread) {
    if (typeof args.memory.thread === 'string') return { id: args.memory.thread };
    if (typeof args.memory.thread === 'object' && args.memory.thread.id) return args.memory.thread;
  }
  if (args?.threadId) return { id: args.threadId };
  return undefined;
}

/**
 * Creates a Mastra workflow that encapsulates the agent generation process
 * with before and after steps for proper lifecycle management
 */
export function createAgentGenerationWorkflow<
  OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
  EXPERIMENTAL_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
>(agentInstance: any) {
  // Define the workflow input schema
  const workflowInputSchema = z.object({
    messages: z.union([
      z.string(),
      z.array(z.string()),
      z.array(z.any()), // CoreMessage[] or AiMessageType[]
    ]),
    generateOptions: z.any(), // AgentGenerateOptions
  });

  // Define the workflow output schema
  const workflowOutputSchema = z.object({
    finalResult: z.any(), // GenerateTextResult or GenerateObjectResult
  });

  // Create the workflow
  const workflow = createWorkflow({
    id: `agent-generation-${agentInstance.id}-${randomUUID()}`,
    description: `Agent ${agentInstance.name} generation workflow with before/after lifecycle`,
    inputSchema: workflowInputSchema,
    outputSchema: workflowOutputSchema,
  });

  // Step 1: Before processing (setup and preparation)
  const beforeStep = createStep({
    id: 'before-generation',
    description: 'Prepare agent generation context, memory, and tools',
    inputSchema: workflowInputSchema,
    outputSchema: z.object({
      thread: z.any().optional(),
      messageObjects: z.array(z.any()),
      convertedTools: z.record(z.any()),
      messageList: z.any(),
      threadId: z.string().optional(),
      memoryConfig: z.any().optional(),
      resourceId: z.string().optional(),
      runId: z.string(),
      instructions: z.string(),
      llm: z.any(),
      saveQueueManager: z.any(),
      toolCallsCollection: z.any(),
      processedOptions: z.any(),
    }),
    execute: async ({ inputData, mastra }) => {
      const { messages, generateOptions } = inputData;
      const agent = agentInstance;

      // Extract options (mirroring the original generate method)
      const defaultGenerateOptions = await agent.getDefaultGenerateOptions({
        runtimeContext: generateOptions.runtimeContext,
      });

      const {
        context,
        memoryOptions: memoryConfigFromArgs,
        resourceId: resourceIdFromArgs,
        maxSteps,
        onStepFinish,
        output,
        toolsets,
        clientTools,
        temperature,
        toolChoice = 'auto',
        experimental_output,
        telemetry,
        runtimeContext = new RuntimeContext(),
        savePerStep = false,
        ...args
      } = Object.assign({}, defaultGenerateOptions, generateOptions);

      const generateMessageId =
        `experimental_generateMessageId` in args && typeof args.experimental_generateMessageId === `function`
          ? (args.experimental_generateMessageId as IDGenerator)
          : undefined;

      const threadFromArgs = resolveThreadIdFromArgs({ ...args, ...generateOptions });
      const resourceId = args.memory?.resource || resourceIdFromArgs;
      const memoryConfig = args.memory?.options || memoryConfigFromArgs;

      if (resourceId && threadFromArgs && !agent.hasOwnMemory()) {
        agent.logger.warn(
          `[Agent:${agent.name}] - No memory is configured but resourceId and threadId were passed in args. This will not work.`,
        );
      }

      const runId = args.runId || randomUUID();
      const instructions = args.instructions || (await agent.getInstructions({ runtimeContext }));
      const llm = await agent.getLLM({ runtimeContext });

      const memory = await agent.getMemory({ runtimeContext });
      const saveQueueManager = new SaveQueueManager({
        logger: agent.logger,
        memory,
      });

      // Execute the original before logic
      const { before } = agent.__primitive({
        messages,
        instructions,
        context,
        thread: threadFromArgs,
        memoryConfig,
        resourceId,
        runId,
        toolsets,
        clientTools,
        runtimeContext,
        generateMessageId,
        saveQueueManager,
      });

      const { thread, messageObjects, convertedTools, messageList } = await before();
      const threadId = thread?.id;
      const toolCallsCollection = new Map();

      return {
        thread,
        messageObjects,
        convertedTools,
        messageList,
        threadId,
        memoryConfig,
        resourceId,
        runId,
        instructions,
        llm,
        saveQueueManager,
        toolCallsCollection,
        processedOptions: {
          maxSteps,
          onStepFinish,
          output,
          temperature,
          toolChoice,
          experimental_output,
          telemetry,
          savePerStep,
          runtimeContext,
          ...args,
        },
      };
    },
  });

  // Step 2: LLM generation (core processing)
  const generationStep = createStep({
    id: 'llm-generation',
    description: 'Execute LLM generation with prepared context and tools',
    inputSchema: beforeStep.outputSchema,
    outputSchema: z.object({
      result: z.any(),
      outputText: z.string(),
      beforeStepData: z.any(), // Pass through data needed for after step
    }),
    execute: async ({ inputData }) => {
      const {
        messageObjects,
        convertedTools,
        messageList,
        threadId,
        memoryConfig,
        runId,
        llm,
        saveQueueManager,
        toolCallsCollection,
        processedOptions,
      } = inputData;

      const {
        maxSteps,
        onStepFinish,
        output,
        temperature,
        toolChoice,
        experimental_output,
        telemetry,
        savePerStep,
        runtimeContext,
        ...args
      } = processedOptions;

      const agent = agentInstance;

      // Helper method for saving step messages
      const saveStepMessages = async ({
        saveQueueManager,
        result,
        messageList,
        threadId,
        memoryConfig,
        runId,
      }: {
        saveQueueManager: any;
        result: any;
        messageList: any;
        threadId?: string;
        memoryConfig?: any;
        runId?: string;
      }) => {
        try {
          messageList.add(result.response.messages, 'response');
          await saveQueueManager.batchMessages(messageList, threadId, memoryConfig);
        } catch (e) {
          await saveQueueManager.flushMessages(messageList, threadId, memoryConfig);
          agent.logger.error('Error saving memory on step finish', {
            error: e,
            runId,
          });
          throw e;
        }
      };

      // Create onStepFinish function that updates toolCallsCollection
      const onStepFinishFn = async (result: any) => {
        if (result.finishReason === 'tool-calls') {
          for (const toolCall of result.toolCalls) {
            toolCallsCollection.set(toolCall.toolCallId, toolCall);
          }
        }
        if (savePerStep) {
          await saveStepMessages({
            saveQueueManager,
            result,
            messageList,
            threadId,
            memoryConfig,
            runId,
          });
        }
        return onStepFinish?.({ ...result, runId });
      };

      let result: any;
      let outputText: string;

      // Execute the appropriate LLM method based on output type
      if (!output && experimental_output) {
        result = await llm.__text({
          messages: messageObjects,
          tools: convertedTools,
          onStepFinish: onStepFinishFn,
          maxSteps,
          runId,
          temperature,
          toolChoice: toolChoice || 'auto',
          experimental_output,
          threadId,
          resourceId: inputData.resourceId,
          memory: agent.getMemory(),
          runtimeContext,
          telemetry,
          ...args,
        });
        outputText = result.text;
        const newResult = result as any;
        newResult.object = result.experimental_output;
        result = newResult;
      } else if (!output) {
        result = await llm.__text({
          messages: messageObjects,
          tools: convertedTools,
          onStepFinish: onStepFinishFn,
          maxSteps,
          runId,
          temperature,
          toolChoice,
          telemetry,
          threadId,
          resourceId: inputData.resourceId,
          memory: agent.getMemory(),
          runtimeContext,
          ...args,
        });
        outputText = result.text;
      } else {
        result = await llm.__textObject({
          messages: messageObjects,
          tools: convertedTools,
          structuredOutput: output,
          onStepFinish: onStepFinishFn,
          maxSteps,
          runId,
          temperature,
          toolChoice,
          telemetry,
          memory: agent.getMemory(),
          runtimeContext,
          ...args,
        });
        outputText = JSON.stringify(result.object);
      }

      return {
        result,
        outputText,
        beforeStepData: inputData, // Pass through for after step
      };
    },
  });

  // Step 3: After processing (cleanup and persistence)
  const afterStep = createStep({
    id: 'after-generation',
    description: 'Handle post-generation tasks like memory persistence and scoring',
    inputSchema: z.object({
      result: z.any(),
      outputText: z.string(),
      beforeStepData: z.any(),
    }),
    outputSchema: workflowOutputSchema,
    execute: async ({ inputData }) => {
      const { result, outputText, beforeStepData } = inputData;
      const {
        thread,
        threadId,
        memoryConfig,
        runId,
        messageList,
        toolCallsCollection,
        saveQueueManager,
        instructions,
      } = beforeStepData;

      const agent = agentInstance;
      const runtimeContext = beforeStepData.processedOptions.runtimeContext || new RuntimeContext();

      // Execute the original after logic
      const { after } = agent.__primitive({
        messages: [], // Not needed for after
        instructions,
        context: [],
        thread,
        memoryConfig,
        resourceId: beforeStepData.resourceId,
        runId,
        toolsets: {},
        clientTools: {},
        runtimeContext,
        generateMessageId: undefined,
        saveQueueManager,
      });

      await after({
        result,
        thread,
        threadId,
        memoryConfig,
        outputText,
        runId,
        messageList,
        toolCallsCollection,
        structuredOutput: !!beforeStepData.processedOptions.output,
      });

      return {
        finalResult: result,
      };
    },
  });

  // Chain the steps together and commit the workflow
  workflow.then(beforeStep).then(generationStep).then(afterStep).commit();

  return workflow;
}