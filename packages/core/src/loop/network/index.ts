import { parsePartialJson } from '@internal/ai-sdk-v5';
import z from 'zod';
import type { Mastra } from '../..';
import type { AgentExecutionOptions } from '../../agent';
import type { MultiPrimitiveExecutionOptions, NetworkOptions } from '../../agent/agent.types';
import { Agent, tryGenerateWithJsonFallback } from '../../agent/index';
import { MessageList } from '../../agent/message-list';
import type { MastraDBMessage, MessageListInput } from '../../agent/message-list';
import type { StructuredOutputOptions } from '../../agent/types';
import { ErrorCategory, ErrorDomain, MastraError } from '../../error';
import type { MastraLLMVNext } from '../../llm/model/model.loop';
import { noopLogger } from '../../logger';
import type { TracingContext } from '../../observability';
import { ProcessorRunner } from '../../processors/runner';
import type { RequestContext } from '../../request-context';
import { ChunkFrom } from '../../stream';
import type { ChunkType } from '../../stream';
import { escapeUnescapedControlCharsInJsonStrings } from '../../stream/base/output-format-handlers';
import { MastraAgentNetworkStream } from '../../stream/MastraAgentNetworkStream';
import type { IdGeneratorContext } from '../../types';
import { createStep, createWorkflow } from '../../workflows';
import type { Step, SuspendOptions } from '../../workflows';
import { zodToJsonSchema } from '../../zod-to-json';
import { PRIMITIVE_TYPES } from '../types';
import type { CompletionConfig, CompletionContext } from './validation';
import {
  runValidation,
  formatCompletionFeedback,
  runDefaultCompletionCheck,
  generateFinalResult,
  generateStructuredFinalResult,
} from './validation';

/**
 * Safely parses JSON from LLM output, handling common issues like:
 * - Unescaped control characters (newlines, tabs) in strings
 * - Truncated/incomplete JSON (missing closing braces)
 * - Partial JSON from token limits
 *
 * @param text - Raw JSON text from LLM output
 * @returns Parsed value or null if parsing fails completely
 */
async function safeParseLLMJson(text: string): Promise<unknown | null> {
  if (!text?.trim()) {
    return null;
  }

  // First fix common LLM issues with control characters in strings
  const preprocessed = escapeUnescapedControlCharsInJsonStrings(text);

  // Use parsePartialJson which can recover truncated/incomplete JSON
  const { value, state } = await parsePartialJson(preprocessed);

  // Accept successful or repaired parses
  if (state === 'successful-parse' || state === 'repaired-parse') {
    return value;
  }

  return null;
}

/**
 * Type for ID generator function that can optionally accept context
 */
type NetworkIdGenerator = (context?: IdGeneratorContext) => string;

/**
 * Filters messages to extract conversation context for sub-agents.
 * Includes user messages and assistant messages that are NOT internal network JSON.
 * Excludes:
 * - isNetwork: true JSON (result markers after primitive execution)
 * - Routing agent decision JSON (has primitiveId/primitiveType/selectionReason)
 * - Completion feedback messages (metadata.mode === 'network' or metadata.completionResult)
 */
function filterMessagesForSubAgent(messages: MastraDBMessage[]): MastraDBMessage[] {
  return messages.filter(msg => {
    // Include all user messages
    if (msg.role === 'user') return true;

    // Include assistant messages that are NOT internal network messages
    if (msg.role === 'assistant') {
      // Check metadata for network-internal markers (e.g., completion feedback)
      // These messages are saved with metadata flags but plain text content
      const metadata = msg.content?.metadata;
      if (metadata?.mode === 'network' || metadata?.completionResult) {
        return false;
      }

      // Check ALL parts for network-internal JSON
      const parts = msg.content?.parts ?? [];
      for (const part of parts) {
        if (part?.type === 'text' && part?.text) {
          try {
            const parsed = JSON.parse(part.text);
            // Exclude isNetwork JSON (result markers after execution)
            if (parsed.isNetwork) return false;
            // Exclude routing agent decision JSON (has primitiveId + selectionReason)
            if (parsed.primitiveId && parsed.selectionReason) return false;
          } catch {
            // Not JSON, continue checking other parts
          }
        }
      }
      return true;
    }

    return false;
  });
}

/** @internal Exported for testing purposes */
export async function getRoutingAgent({
  requestContext,
  agent,
  routingConfig,
}: {
  agent: Agent;
  requestContext: RequestContext;
  routingConfig?: {
    additionalInstructions?: string;
  };
}) {
  const instructionsToUse = await agent.getInstructions({ requestContext: requestContext });
  const agentsToUse = await agent.listAgents({ requestContext: requestContext });
  const workflowsToUse = await agent.listWorkflows({ requestContext: requestContext });
  const toolsToUse = await agent.listTools({ requestContext: requestContext });
  const model = await agent.getModel({ requestContext: requestContext });
  const memoryToUse = await agent.getMemory({ requestContext: requestContext });
  const clientToolsToUse = (await agent.getDefaultOptions({ requestContext: requestContext }))?.clientTools;

  // Get only user-configured processors (not memory processors) for the routing agent.
  // Memory processors (semantic recall, working memory) can interfere with routing decisions,
  // but user-configured processors like token limiters should be applied.
  const configuredInputProcessors = await agent.listConfiguredInputProcessors(requestContext);
  const configuredOutputProcessors = await agent.listConfiguredOutputProcessors(requestContext);

  const agentList = Object.entries(agentsToUse)
    .map(([name, agent]) => {
      // Use agent name instead of description since description might not exist
      return ` - **${name}**: ${agent.getDescription()}`;
    })
    .join('\n');

  const workflowList = Object.entries(workflowsToUse)
    .map(([name, workflow]) => {
      return ` - **${name}**: ${workflow.description}, input schema: ${JSON.stringify(
        zodToJsonSchema(workflow.inputSchema ?? z.object({})),
      )}`;
    })
    .join('\n');

  const memoryTools = await memoryToUse?.listTools?.();
  const toolList = Object.entries({ ...toolsToUse, ...memoryTools, ...(clientToolsToUse || {}) })
    .map(([name, tool]) => {
      // Use 'in' check for type narrowing, then nullish coalescing for undefined values
      const inputSchema = 'inputSchema' in tool ? (tool.inputSchema ?? z.object({})) : z.object({});
      return ` - **${name}**: ${tool.description}, input schema: ${JSON.stringify(zodToJsonSchema(inputSchema))}`;
    })
    .join('\n');

  const additionalInstructionsSection = routingConfig?.additionalInstructions
    ? `\n## Additional Instructions\n${routingConfig.additionalInstructions}`
    : '';

  const instructions = `
          You are a router in a network of specialized AI agents.
          Your job is to decide which agent should handle each step of a task.
          If asking for completion of a task, make sure to follow system instructions closely.

          Every step will result in a prompt message. It will be a JSON object with a "selectionReason" and "finalResult" property. Make your decision based on previous decision history, as well as the overall task criteria. If you already called a primitive, you shouldn't need to call it again, unless you strongly believe it adds something to the task completion criteria. Make sure to call enough primitives to complete the task.

          ## System Instructions
          ${instructionsToUse}
          You can only pick agents and workflows that are available in the lists below. Never call any agents or workflows that are not available in the lists below.
          ## Available Agents in Network
          ${agentList}
          ## Available Workflows in Network (make sure to use inputs corresponding to the input schema when calling a workflow)
          ${workflowList}
          ## Available Tools in Network (make sure to use inputs corresponding to the input schema when calling a tool)
          ${toolList}
          If you have multiple entries that need to be called with a workflow or agent, call them separately with each input.
          When calling a workflow, the prompt should be a JSON value that corresponds to the input schema of the workflow. The JSON value is stringified.
          When calling a tool, the prompt should be a JSON value that corresponds to the input schema of the tool. The JSON value is stringified.
          When calling an agent, the prompt should be a text value, like you would call an LLM in a chat interface.
          Keep in mind that the user only sees the final result of the task. When reviewing completion, you should know that the user will not see the intermediate results.
          ${additionalInstructionsSection}
        `;

  return new Agent({
    id: 'routing-agent',
    name: 'Routing Agent',
    instructions,
    model: model,
    memory: memoryToUse,
    inputProcessors: configuredInputProcessors,
    outputProcessors: configuredOutputProcessors,
    // @ts-expect-error - internal property for agent network
    _agentNetworkAppend: true,
  });
}

export function getLastMessage(messages: MessageListInput) {
  let message = '';
  if (typeof messages === 'string') {
    message = messages;
  } else {
    const lastMessage = Array.isArray(messages) ? messages[messages.length - 1] : messages;
    if (typeof lastMessage === 'string') {
      message = lastMessage;
    } else if (lastMessage && 'content' in lastMessage && lastMessage?.content) {
      const lastMessageContent = lastMessage.content;
      if (typeof lastMessageContent === 'string') {
        message = lastMessageContent;
      } else if (Array.isArray(lastMessageContent)) {
        const lastPart = lastMessageContent[lastMessageContent.length - 1];
        if (lastPart?.type === 'text') {
          message = lastPart.text;
        }
      }
    } else if (lastMessage && 'parts' in lastMessage && lastMessage?.parts) {
      // Handle messages with 'parts' format (e.g. from MessageList)
      const parts = lastMessage.parts;
      if (Array.isArray(parts)) {
        const lastPart = parts[parts.length - 1];
        if (lastPart?.type === 'text' && lastPart?.text) {
          message = lastPart.text;
        }
      }
    }
  }

  return message;
}

export async function prepareMemoryStep({
  threadId,
  resourceId,
  messages,
  routingAgent,
  requestContext,
  generateId,
  tracingContext,
  memoryConfig,
}: {
  threadId: string;
  resourceId: string;
  messages: MessageListInput;
  routingAgent: Agent;
  requestContext: RequestContext;
  generateId: NetworkIdGenerator;
  tracingContext?: TracingContext;
  memoryConfig?: any;
}) {
  const memory = await routingAgent.getMemory({ requestContext });
  let thread = await memory?.getThreadById({ threadId });
  if (!thread) {
    thread = await memory?.createThread({
      threadId,
      title: `New Thread ${new Date().toISOString()}`,
      resourceId,
    });
  }
  let userMessage: string | undefined;

  // Parallelize async operations
  const promises: Promise<any>[] = [];

  if (typeof messages === 'string') {
    userMessage = messages;
    if (memory) {
      promises.push(
        memory.saveMessages({
          messages: [
            {
              id: generateId({
                idType: 'message',
                source: 'agent',
                threadId: thread?.id,
                resourceId: thread?.resourceId,
                role: 'user',
              }),
              type: 'text',
              role: 'user',
              content: { parts: [{ type: 'text', text: messages }], format: 2 },
              createdAt: new Date(),
              threadId: thread?.id,
              resourceId: thread?.resourceId,
            },
          ] as MastraDBMessage[],
        }),
      );
    }
  } else {
    const messageList = new MessageList({
      threadId: thread?.id,
      resourceId: thread?.resourceId,
    });
    messageList.add(messages, 'user');
    const messagesToSave = messageList.get.all.db();

    if (memory) {
      promises.push(
        memory.saveMessages({
          messages: messagesToSave,
        }),
      );
    }

    // Get the user message for title generation
    const uiMessages = messageList.get.all.ui();
    const mostRecentUserMessage = routingAgent.getMostRecentUserMessage(uiMessages);
    userMessage = mostRecentUserMessage?.content;
  }

  // Add title generation to promises if needed (non-blocking)
  // Check if this is the first user message by looking at existing messages in the thread
  // This works automatically for pre-created threads without requiring any metadata flags
  if (thread && memory) {
    const config = memory.getMergedThreadConfig(memoryConfig || {});

    const {
      shouldGenerate,
      model: titleModel,
      instructions: titleInstructions,
    } = routingAgent.resolveTitleGenerationConfig(config?.generateTitle);

    if (shouldGenerate && userMessage) {
      // Check for existing user messages in the thread - if none, this is the first user message
      // We fetch existing messages before the new message is saved
      const existingMessages = await memory.recall({
        threadId: thread.id,
        resourceId: thread.resourceId,
      });
      const existingUserMessages = existingMessages.messages.filter(m => m.role === 'user');
      const isFirstUserMessage = existingUserMessages.length === 0;

      if (isFirstUserMessage) {
        promises.push(
          routingAgent
            .genTitle(
              userMessage,
              requestContext,
              tracingContext || { currentSpan: undefined },
              titleModel,
              titleInstructions,
            )
            .then(title => {
              if (title) {
                return memory.createThread({
                  threadId: thread.id,
                  resourceId: thread.resourceId,
                  memoryConfig,
                  title,
                  metadata: thread.metadata,
                });
              }
            }),
        );
      }
    }
  }

  await Promise.all(promises);

  return { thread };
}

/**
 * Saves the finalResult to memory if the LLM provided one.
 * The LLM is instructed to omit finalResult when the primitive result is already sufficient,
 * so we only need to check if finalResult is defined.
 *
 * @internal
 */
/**
 * Helper function to apply output processors to messages before saving.
 * This ensures that user-configured output processors (like TraceIdInjector)
 * are applied to all messages saved during network execution.
 */
async function saveMessagesWithProcessors(
  memory:
    | { saveMessages: (params: { messages: MastraDBMessage[] }) => Promise<{ messages: MastraDBMessage[] }> }
    | undefined,
  messages: MastraDBMessage[],
  processorRunner: ProcessorRunner | null,
  context?: {
    tracingContext?: TracingContext;
    requestContext?: RequestContext;
  },
): Promise<void> {
  if (!memory) return;

  if (!processorRunner || messages.length === 0) {
    await memory.saveMessages({ messages });
    return;
  }

  // Create a MessageList and add the messages as 'response' type
  const messageList = new MessageList();
  for (const msg of messages) {
    messageList.add(msg, 'response');
  }

  // Run output processors on the messages
  await processorRunner.runOutputProcessors(messageList, context?.tracingContext, context?.requestContext);

  // Get the processed messages and save them
  const processedMessages = messageList.get.response.db();
  await memory.saveMessages({ messages: processedMessages });
}

async function saveFinalResultIfProvided({
  memory,
  finalResult,
  threadId,
  resourceId,
  generateId,
  processorRunner,
  requestContext,
}: {
  memory: Awaited<ReturnType<Agent['getMemory']>>;
  finalResult: string | undefined;
  threadId: string;
  resourceId: string;
  generateId: () => string;
  processorRunner: ProcessorRunner | null;
  requestContext?: RequestContext;
}) {
  if (memory && finalResult) {
    await saveMessagesWithProcessors(
      memory,
      [
        {
          id: generateId(),
          type: 'text',
          role: 'assistant',
          content: {
            parts: [{ type: 'text', text: finalResult }],
            format: 2,
          },
          createdAt: new Date(),
          threadId,
          resourceId,
        },
      ] as MastraDBMessage[],
      processorRunner,
      { requestContext },
    );
  }
}

export async function createNetworkLoop({
  networkName,
  requestContext,
  runId,
  agent,
  generateId,
  routingAgentOptions,
  routing,
  onAbort,
  abortSignal,
}: {
  networkName: string;
  requestContext: RequestContext;
  runId: string;
  agent: Agent;
  routingAgentOptions?: Pick<MultiPrimitiveExecutionOptions, 'modelSettings'>;
  generateId: NetworkIdGenerator;
  routing?: {
    additionalInstructions?: string;
    verboseIntrospection?: boolean;
  };
  onAbort?: (event: any) => Promise<void> | void;
  abortSignal?: AbortSignal;
}) {
  // Get configured output processors from the agent for applying to saved messages
  const configuredOutputProcessors = await agent.listConfiguredOutputProcessors(requestContext);

  // Create a ProcessorRunner if there are output processors to apply
  const processorRunner =
    configuredOutputProcessors.length > 0
      ? new ProcessorRunner({
          outputProcessors: configuredOutputProcessors,
          inputProcessors: [],
          logger: agent.getMastraInstance()?.getLogger() || noopLogger,
          agentName: agent.name,
        })
      : null;

  const routingStep = createStep({
    id: 'routing-agent-step',
    inputSchema: z.object({
      task: z.string(),
      primitiveId: z.string(),
      primitiveType: PRIMITIVE_TYPES,
      result: z.string().optional(),
      iteration: z.number(),
      threadId: z.string().optional(),
      threadResourceId: z.string().optional(),
      isOneOff: z.boolean(),
      verboseIntrospection: z.boolean(),
    }),
    outputSchema: z.object({
      task: z.string(),
      primitiveId: z.string(),
      primitiveType: PRIMITIVE_TYPES,
      prompt: z.string(),
      result: z.string(),
      isComplete: z.boolean().optional(),
      selectionReason: z.string(),
      iteration: z.number(),
      conversationContext: z.array(z.any()).optional(),
    }),
    execute: async ({ inputData, getInitData, writer }) => {
      // Check if aborted before executing
      if (abortSignal?.aborted) {
        await onAbort?.({
          primitiveType: 'routing',
          primitiveId: 'routing-agent',
          iteration: inputData.iteration,
        });
        await writer?.write({
          type: 'routing-agent-abort',
          runId,
          from: ChunkFrom.NETWORK,
          payload: {
            primitiveType: 'routing',
            primitiveId: 'routing-agent',
          },
        });
        return {
          task: inputData.task,
          primitiveId: 'none',
          primitiveType: 'none' as const,
          prompt: '',
          result: 'Aborted',
          isComplete: true,
          selectionReason: 'Aborted',
          iteration: inputData.iteration,
          conversationContext: [],
        };
      }

      const initData = await getInitData<{ threadId: string; threadResourceId: string }>();

      const routingAgent = await getRoutingAgent({ requestContext, agent, routingConfig: routing });

      // Increment iteration counter. Must use nullish coalescing (??) not ternary (?)
      // to avoid treating 0 as falsy. Initial value is -1, so first iteration becomes 0.
      const iterationCount = (inputData.iteration ?? -1) + 1;

      const stepId = generateId({
        idType: 'step',
        source: 'agent',
        stepType: 'routing-agent',
      });
      await writer.write({
        type: 'routing-agent-start',
        payload: {
          networkId: agent.id,
          agentId: routingAgent.id,
          runId: stepId,
          inputData: {
            ...inputData,
            iteration: iterationCount,
          },
        },
        runId,
        from: ChunkFrom.NETWORK,
      });

      // Completion is now always handled by scorers in the validation step
      // The routing step only handles primitive selection

      const prompt: MessageListInput = [
        {
          role: 'assistant',
          content: `
                    ${inputData.isOneOff ? 'You are executing just one primitive based on the user task. Make sure to pick the primitive that is the best suited to accomplish the whole task. Primitives that execute only part of the task should be avoided.' : 'You will be calling just *one* primitive at a time to accomplish the user task, every call to you is one decision in the process of accomplishing the user task. Make sure to pick primitives that are the best suited to accomplish the whole task. Completeness is the highest priority.'}

                    The user has given you the following task:
                    ${inputData.task}

                    # Rules:

                    ## Agent:
                    - prompt should be a text value, like you would call an LLM in a chat interface.
                    - If you are calling the same agent again, make sure to adjust the prompt to be more specific.

                    ## Workflow/Tool:
                    - prompt should be a JSON value that corresponds to the input schema of the workflow or tool. The JSON value is stringified.
                    - Make sure to use inputs corresponding to the input schema when calling a workflow or tool.

                    DO NOT CALL THE PRIMITIVE YOURSELF. Make sure to not call the same primitive twice, unless you call it with different arguments and believe it adds something to the task completion criteria. Take into account previous decision making history and results in your decision making and final result. These are messages whose text is a JSON structure with "isNetwork" true.

                    Please select the most appropriate primitive to handle this task and the prompt to be sent to the primitive. If no primitive is appropriate, return "none" for the primitiveId and "none" for the primitiveType.

                    {
                        "primitiveId": string,
                        "primitiveType": "agent" | "workflow" | "tool",
                        "prompt": string,
                        "selectionReason": string
                    }

                    The 'selectionReason' property should explain why you picked the primitive${inputData.verboseIntrospection ? ', as well as why the other primitives were not picked.' : '.'}
                    `,
        },
      ];

      const options = {
        structuredOutput: {
          schema: z.object({
            primitiveId: z.string().describe('The id of the primitive to be called'),
            primitiveType: PRIMITIVE_TYPES.describe('The type of the primitive to be called'),
            prompt: z.string().describe('The json string or text value to be sent to the primitive'),
            selectionReason: z.string().describe('The reason you picked the primitive'),
          }),
        },
        requestContext: requestContext,
        maxSteps: 1,
        memory: {
          thread: initData?.threadId ?? runId,
          resource: initData?.threadResourceId ?? networkName,
          options: {
            readOnly: true,
            workingMemory: {
              enabled: false,
            },
          },
        },
        ...routingAgentOptions,
        abortSignal,
        onAbort,
      };

      const result = await tryGenerateWithJsonFallback(routingAgent, prompt, options);

      const object = await result.object;

      if (!object) {
        throw new MastraError({
          id: 'AGENT_NETWORK_ROUTING_AGENT_INVALID_OUTPUT',
          domain: ErrorDomain.AGENT_NETWORK,
          category: ErrorCategory.SYSTEM,
          text: `Routing agent returned undefined for 'object'. This may indicate an issue with the model's response or structured output parsing.`,
          details: {
            finishReason: result.finishReason ?? null,
            usage: JSON.stringify(result.usage) ?? null,
          },
        });
      }

      const isComplete = object.primitiveId === 'none' && object.primitiveType === 'none';

      // Extract conversation context from the memory-loaded messages only.
      const conversationContext = filterMessagesForSubAgent(result.rememberedMessages ?? []);

      const endPayload = {
        task: inputData.task,
        result: isComplete ? object.selectionReason : '',
        primitiveId: object.primitiveId,
        primitiveType: object.primitiveType,
        prompt: object.prompt,
        isComplete,
        selectionReason: object.selectionReason,
        iteration: iterationCount,
        runId: stepId,
        conversationContext,
      };

      await writer.write({
        type: 'routing-agent-end',
        payload: {
          ...endPayload,
          usage: result.usage,
        },
        from: ChunkFrom.NETWORK,
        runId,
      });

      return endPayload;
    },
  });

  const agentStep = createStep({
    id: 'agent-execution-step',
    inputSchema: z.object({
      task: z.string(),
      primitiveId: z.string(),
      primitiveType: PRIMITIVE_TYPES,
      prompt: z.string(),
      result: z.string(),
      isComplete: z.boolean().optional(),
      selectionReason: z.string(),
      iteration: z.number(),
      conversationContext: z.array(z.any()).optional(),
    }),
    outputSchema: z.object({
      task: z.string(),
      primitiveId: z.string(),
      primitiveType: PRIMITIVE_TYPES,
      result: z.string(),
      isComplete: z.boolean().optional(),
      iteration: z.number(),
    }),
    execute: async ({ inputData, writer, getInitData, suspend, resumeData }) => {
      // Check if aborted before executing
      if (abortSignal?.aborted) {
        await onAbort?.({
          primitiveType: 'agent',
          primitiveId: inputData.primitiveId,
          iteration: inputData.iteration,
        });
        await writer?.write({
          type: 'agent-execution-abort',
          runId,
          from: ChunkFrom.NETWORK,
          payload: {
            primitiveType: 'agent',
            primitiveId: inputData.primitiveId,
          },
        });
        return {
          task: inputData.task,
          primitiveId: inputData.primitiveId,
          primitiveType: inputData.primitiveType,
          result: 'Aborted',
          isComplete: true,
          iteration: inputData.iteration,
        };
      }

      const agentsMap = await agent.listAgents({ requestContext });

      const agentForStep = agentsMap[inputData.primitiveId];

      if (!agentForStep) {
        const mastraError = new MastraError({
          id: 'AGENT_NETWORK_AGENT_EXECUTION_STEP_INVALID_TASK_INPUT',
          domain: ErrorDomain.AGENT_NETWORK,
          category: ErrorCategory.USER,
          text: `Agent ${inputData.primitiveId} not found`,
        });
        // TODO pass agent logger in here
        // logger.trackException(mastraError);
        // logger.error(mastraError.toString());
        throw mastraError;
      }

      const agentId = agentForStep.id;
      const stepId = generateId({
        idType: 'step',
        source: 'agent',
        entityId: agentId,
        stepType: 'agent-execution',
      });
      await writer.write({
        type: 'agent-execution-start',
        payload: {
          agentId,
          args: inputData,
          runId: stepId,
        },
        from: ChunkFrom.NETWORK,
        runId,
      });

      // Get memory context from initData to pass to sub-agents
      // This ensures sub-agents can access the same thread/resource for memory operations
      const initData = await getInitData<{ threadId: string; threadResourceId: string }>();
      const threadId = initData?.threadId || runId;
      const resourceId = initData?.threadResourceId || networkName;

      // Use conversation context passed from routingStep.
      const conversationContext = inputData.conversationContext ?? [];

      // Build the messages to send to the sub-agent:
      // 1. Conversation history (user + non-isNetwork assistant messages) for context
      // 2. The routing agent's prompt (the specific task for this sub-agent)
      const messagesForSubAgent: MessageListInput = [
        ...conversationContext,
        { role: 'user' as const, content: inputData.prompt },
      ];

      // We set lastMessages: 0 to prevent loading messages from the network's thread
      // (which contains isNetwork JSON and completion feedback). We still pass
      // threadId/resourceId so working memory tools function correctly.
      const result = await (resumeData
        ? agentForStep.resumeStream(resumeData, {
            requestContext: requestContext,
            runId,
            memory: {
              thread: threadId,
              resource: resourceId,
              options: {
                lastMessages: 0,
              },
            },
            abortSignal,
            onAbort,
          })
        : agentForStep.stream(messagesForSubAgent, {
            requestContext: requestContext,
            runId,
            memory: {
              thread: threadId,
              resource: resourceId,
              options: {
                lastMessages: 0,
              },
            },
            abortSignal,
            onAbort,
          }));

      let requireApprovalMetadata: Record<string, any> | undefined;
      let suspendedTools: Record<string, any> | undefined;

      let toolCallDeclined = false;

      let agentCallAborted = false;

      for await (const chunk of result.fullStream) {
        await writer.write({
          type: `agent-execution-event-${chunk.type}`,
          payload: {
            ...chunk,
            runId: stepId,
          },
          from: ChunkFrom.NETWORK,
          runId,
        });
        if (chunk.type === 'tool-call-approval') {
          requireApprovalMetadata = {
            ...(requireApprovalMetadata ?? {}),
            [inputData.primitiveId]: {
              resumeSchema: chunk.payload.resumeSchema,
              args: { prompt: inputData.prompt },
              toolName: inputData.primitiveId,
              toolCallId: inputData.primitiveId,
              runId,
              type: 'approval',
              primitiveType: 'agent',
              primitiveId: inputData.primitiveId,
            },
          };
        }
        if (chunk.type === 'tool-call-suspended') {
          suspendedTools = {
            ...(suspendedTools ?? {}),
            [inputData.primitiveId]: {
              suspendPayload: chunk.payload.suspendPayload,
              resumeSchema: chunk.payload.resumeSchema,
              toolName: inputData.primitiveId,
              toolCallId: inputData.primitiveId,
              args: { prompt: inputData.prompt },
              runId,
              type: 'suspension',
              primitiveType: 'agent',
              primitiveId: inputData.primitiveId,
            },
          };
        }

        if (chunk.type === 'tool-result') {
          if (chunk.payload.result === 'Tool call was not approved by the user') {
            toolCallDeclined = true;
          }
        }

        if (chunk.type === 'abort') {
          agentCallAborted = true;
        }
      }

      const memory = await agent.getMemory({ requestContext: requestContext });

      const messages = result.messageList.get.all.v1();

      let finalText = await result.text;
      if (toolCallDeclined) {
        finalText = finalText + '\n\nTool call was not approved by the user';
      }

      if (agentCallAborted) {
        finalText = 'Aborted';
      }

      await saveMessagesWithProcessors(
        memory,
        [
          {
            id: generateId({
              idType: 'message',
              source: 'agent',
              entityId: agentId,
              threadId: initData?.threadId || runId,
              resourceId: initData?.threadResourceId || networkName,
              role: 'assistant',
            }),
            type: 'text',
            role: 'assistant',
            content: {
              parts: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    isNetwork: true,
                    selectionReason: inputData.selectionReason,
                    primitiveType: inputData.primitiveType,
                    primitiveId: inputData.primitiveId,
                    input: inputData.prompt,
                    finalResult: { text: finalText, messages },
                  }),
                },
              ],
              format: 2,
              metadata: {
                mode: 'network',
                ...(requireApprovalMetadata ? { requireApprovalMetadata } : {}),
                ...(suspendedTools ? { suspendedTools } : {}),
              },
            },
            createdAt: new Date(),
            threadId: initData?.threadId || runId,
            resourceId: initData?.threadResourceId || networkName,
          },
        ] as MastraDBMessage[],
        processorRunner,
        { requestContext },
      );

      if (agentCallAborted) {
        await writer?.write({
          type: 'agent-execution-abort',
          runId,
          from: ChunkFrom.NETWORK,
          payload: {
            primitiveType: 'agent',
            primitiveId: inputData.primitiveId,
          },
        });
        return {
          task: inputData.task,
          primitiveId: inputData.primitiveId,
          primitiveType: inputData.primitiveType,
          result: 'Aborted',
          isComplete: true,
          iteration: inputData.iteration,
        };
      }

      if (requireApprovalMetadata || suspendedTools) {
        await writer.write({
          type: requireApprovalMetadata ? 'agent-execution-approval' : 'agent-execution-suspended',
          payload: {
            args: { prompt: inputData.prompt },
            agentId,
            runId: stepId,
            toolName: inputData.primitiveId,
            toolCallId: inputData.primitiveId,
            usage: await result.usage,
            selectionReason: inputData.selectionReason,
            ...(requireApprovalMetadata
              ? {
                  resumeSchema: requireApprovalMetadata[inputData.primitiveId].resumeSchema,
                }
              : {}),
            ...(suspendedTools
              ? {
                  resumeSchema: suspendedTools[inputData.primitiveId].resumeSchema,
                  suspendPayload: suspendedTools[inputData.primitiveId].suspendPayload,
                }
              : {}),
          },
          from: ChunkFrom.NETWORK,
          runId,
        });
        return await suspend({
          ...(requireApprovalMetadata ? { requireToolApproval: requireApprovalMetadata[inputData.primitiveId] } : {}),
          ...(suspendedTools
            ? {
                toolCallSuspended: suspendedTools[inputData.primitiveId].suspendPayload,
                args: inputData.prompt,
                agentId,
              }
            : {}),
          runId: stepId,
        });
      } else {
        const endPayload = {
          task: inputData.task,
          agentId,
          result: finalText,
          isComplete: false,
          iteration: inputData.iteration,
          runId: stepId,
        };

        await writer.write({
          type: 'agent-execution-end',
          payload: {
            ...endPayload,
            usage: await result.usage,
          },
          from: ChunkFrom.NETWORK,
          runId,
        });

        return {
          task: inputData.task,
          primitiveId: inputData.primitiveId,
          primitiveType: inputData.primitiveType,
          result: finalText,
          isComplete: false,
          iteration: inputData.iteration,
        };
      }
    },
  });

  const workflowStep = createStep({
    id: 'workflow-execution-step',
    inputSchema: z.object({
      task: z.string(),
      primitiveId: z.string(),
      primitiveType: PRIMITIVE_TYPES,
      prompt: z.string(),
      result: z.string(),
      isComplete: z.boolean().optional(),
      selectionReason: z.string(),
      iteration: z.number(),
      conversationContext: z.array(z.any()).optional(),
    }),
    outputSchema: z.object({
      task: z.string(),
      primitiveId: z.string(),
      primitiveType: PRIMITIVE_TYPES,
      result: z.string(),
      isComplete: z.boolean().optional(),
      iteration: z.number(),
    }),
    execute: async ({ inputData, writer, getInitData, suspend, resumeData, mastra }) => {
      // Check if aborted before executing
      if (abortSignal?.aborted) {
        await onAbort?.({
          primitiveType: 'workflow',
          primitiveId: inputData.primitiveId,
          iteration: inputData.iteration,
        });
        await writer?.write({
          type: 'workflow-execution-abort',
          runId,
          from: ChunkFrom.NETWORK,
          payload: {
            primitiveType: 'workflow',
            primitiveId: inputData.primitiveId,
          },
        });
        return {
          task: inputData.task,
          primitiveId: inputData.primitiveId,
          primitiveType: inputData.primitiveType,
          result: 'Aborted',
          isComplete: true,
          iteration: inputData.iteration,
        };
      }

      const workflowsMap = await agent.listWorkflows({ requestContext: requestContext });
      const workflowId = inputData.primitiveId;
      const wf = workflowsMap[workflowId];

      if (!wf) {
        const mastraError = new MastraError({
          id: 'AGENT_NETWORK_WORKFLOW_EXECUTION_STEP_INVALID_TASK_INPUT',
          domain: ErrorDomain.AGENT_NETWORK,
          category: ErrorCategory.USER,
          text: `Workflow ${workflowId} not found`,
        });
        // TODO pass agent logger in here
        // logger.trackException(mastraError);
        // logger.error(mastraError.toString());
        throw mastraError;
      }

      // Use safeParseLLMJson to handle malformed JSON from LLM (truncated, unescaped chars, etc.)
      const input = await safeParseLLMJson(inputData.prompt);
      if (input === null) {
        const logger = mastra?.getLogger();
        logger?.warn(
          `Workflow execution step received invalid JSON prompt for workflow "${inputData.primitiveId}". ` +
            `Prompt was: "${inputData.prompt}". Returning error to routing agent for retry.`,
        );

        return {
          task: inputData.task,
          primitiveId: inputData.primitiveId,
          primitiveType: inputData.primitiveType,
          result:
            `Error: The prompt provided for workflow "${inputData.primitiveId}" is not valid JSON. ` +
            `Received: "${inputData.prompt}". ` +
            `Workflows require a valid JSON string matching their input schema. ` +
            `Please provide the prompt as properly formatted JSON (e.g., {"key": "value"}).`,
          isComplete: false,
          iteration: inputData.iteration,
        };
      }

      const stepId = generateId({
        idType: 'step',
        source: 'workflow',
        entityId: wf.id,
        stepType: 'workflow-execution',
      });
      const run = await wf.createRun({ runId });

      // listen for the network-level abort signal
      const networkAbortCb = async () => {
        await run.cancel();
        await onAbort?.({
          primitiveType: 'workflow',
          primitiveId: inputData.primitiveId,
          iteration: inputData.iteration,
        });
      };
      if (abortSignal) {
        abortSignal.addEventListener('abort', networkAbortCb);
      }

      const toolData = {
        workflowId: wf.id,
        args: inputData,
        runId: stepId,
      };

      await writer?.write({
        type: 'workflow-execution-start',
        payload: toolData,
        from: ChunkFrom.NETWORK,
        runId,
      });

      const stream = resumeData
        ? run.resumeStream({
            resumeData,
            requestContext: requestContext,
          })
        : run.stream({
            inputData: input,
            requestContext: requestContext,
          });

      // const wflowAbortCb = () => {
      //   abort();
      // };
      // run.abortController.signal.addEventListener('abort', wflowAbortCb);
      // wflowAbortSignal.addEventListener('abort', async () => {
      //   run.abortController.signal.removeEventListener('abort', wflowAbortCb);
      //   await run.cancel();
      // });

      // let result: any;
      // let stepResults: Record<string, any> = {};
      let workflowCancelled = false;
      let chunks: ChunkType[] = [];
      for await (const chunk of stream.fullStream) {
        chunks.push(chunk);
        await writer?.write({
          type: `workflow-execution-event-${chunk.type}`,
          payload: {
            ...chunk,
            runId: stepId,
          },
          from: ChunkFrom.NETWORK,
          runId,
        });
        if (chunk.type === 'workflow-canceled') {
          workflowCancelled = true;
        }
      }

      let runSuccess = true;

      const workflowState = await stream.result;

      if (!workflowState?.status || workflowState?.status === 'failed') {
        runSuccess = false;
      }

      let resumeSchema;
      let suspendPayload;
      if (workflowState?.status === 'suspended') {
        const suspendedStep = workflowState?.suspended?.[0]?.[0]!;
        suspendPayload = workflowState?.steps?.[suspendedStep]?.suspendPayload;
        if (suspendPayload?.__workflow_meta) {
          delete suspendPayload.__workflow_meta;
        }
        const firstSuspendedStepPath = [...(workflowState?.suspended?.[0] ?? [])];
        let wflowStep = wf;
        while (firstSuspendedStepPath.length > 0) {
          const key = firstSuspendedStepPath.shift();
          if (key) {
            if (!wflowStep.steps[key]) {
              mastra?.getLogger()?.warn(`Suspended step '${key}' not found in workflow '${workflowId}'`);
              break;
            }
            wflowStep = wflowStep.steps[key] as any;
          }
        }
        const wflowStepSchema = (wflowStep as Step<any, any, any, any, any, any>)?.resumeSchema;
        if (wflowStepSchema) {
          resumeSchema = JSON.stringify(zodToJsonSchema(wflowStepSchema));
        } else {
          resumeSchema = '';
        }
      }

      const finalResult = JSON.stringify({
        isNetwork: true,
        primitiveType: inputData.primitiveType,
        primitiveId: inputData.primitiveId,
        selectionReason: inputData.selectionReason,
        input,
        finalResult: {
          runId: run.runId,
          runResult: workflowState,
          chunks,
          runSuccess,
        },
      });

      const memory = await agent.getMemory({ requestContext: requestContext });
      const initData = await getInitData<{ threadId: string; threadResourceId: string }>();
      await saveMessagesWithProcessors(
        memory,
        [
          {
            id: generateId({
              idType: 'message',
              source: 'workflow',
              entityId: wf.id,
              threadId: initData?.threadId || runId,
              resourceId: initData?.threadResourceId || networkName,
              role: 'assistant',
            }),
            type: 'text',
            role: 'assistant',
            content: {
              parts: [{ type: 'text', text: finalResult }],
              format: 2,
              metadata: {
                mode: 'network',
                ...(suspendPayload
                  ? {
                      suspendedTools: {
                        [inputData.primitiveId]: {
                          args: input,
                          suspendPayload,
                          runId,
                          type: 'suspension',
                          resumeSchema,
                          workflowId,
                          primitiveType: 'workflow',
                          primitiveId: inputData.primitiveId,
                          toolName: inputData.primitiveId,
                          toolCallId: inputData.primitiveId,
                        },
                      },
                    }
                  : {}),
              },
            },
            createdAt: new Date(),
            threadId: initData?.threadId || runId,
            resourceId: initData?.threadResourceId || networkName,
          },
        ] as MastraDBMessage[],
        processorRunner,
        { requestContext },
      );

      if (workflowCancelled && abortSignal?.aborted) {
        await writer?.write({
          type: 'workflow-execution-abort',
          runId,
          from: ChunkFrom.NETWORK,
          payload: {
            primitiveType: 'workflow',
            primitiveId: inputData.primitiveId,
          },
        });
        return {
          task: inputData.task,
          primitiveId: inputData.primitiveId,
          primitiveType: inputData.primitiveType,
          result: 'Aborted',
          isComplete: true,
          iteration: inputData.iteration,
        };
      }

      if (suspendPayload) {
        await writer?.write({
          type: 'workflow-execution-suspended',
          payload: {
            args: input,
            workflowId,
            suspendPayload,
            resumeSchema,
            name: wf.name,
            runId: stepId,
            usage: await stream.usage,
            selectionReason: inputData.selectionReason,
            toolName: inputData.primitiveId,
            toolCallId: inputData.primitiveId,
          },
          from: ChunkFrom.NETWORK,
          runId,
        });
        return suspend({ ...toolData, workflowSuspended: suspendPayload });
      } else {
        const endPayload = {
          task: inputData.task,
          primitiveId: inputData.primitiveId,
          primitiveType: inputData.primitiveType,
          result: finalResult,
          isComplete: false,
          iteration: inputData.iteration,
        };

        await writer?.write({
          type: 'workflow-execution-end',
          payload: {
            ...endPayload,
            result: workflowState,
            name: wf.name,
            runId: stepId,
            usage: await stream.usage,
          },
          from: ChunkFrom.NETWORK,
          runId,
        });

        return endPayload;
      }
    },
  });

  const toolStep = createStep({
    id: 'tool-execution-step',
    inputSchema: z.object({
      task: z.string(),
      primitiveId: z.string(),
      primitiveType: PRIMITIVE_TYPES,
      prompt: z.string(),
      result: z.string(),
      isComplete: z.boolean().optional(),
      selectionReason: z.string(),
      iteration: z.number(),
      conversationContext: z.array(z.any()).optional(),
    }),
    outputSchema: z.object({
      task: z.string(),
      primitiveId: z.string(),
      primitiveType: PRIMITIVE_TYPES,
      result: z.string(),
      isComplete: z.boolean().optional(),
      iteration: z.number(),
    }),
    resumeSchema: z.object({
      approved: z
        .boolean()
        .describe('Controls if the tool call is approved or not, should be true when approved and false when declined'),
    }),
    execute: async ({ inputData, getInitData, writer, resumeData, mastra, suspend }) => {
      const initData = await getInitData<{ threadId: string; threadResourceId: string }>();
      const logger = mastra?.getLogger();

      // Check if aborted before executing
      if (abortSignal?.aborted) {
        await onAbort?.({
          primitiveType: 'tool',
          primitiveId: inputData.primitiveId,
          iteration: inputData.iteration,
        });
        await writer?.write({
          type: 'tool-execution-abort',
          runId,
          from: ChunkFrom.NETWORK,
          payload: {
            primitiveType: 'tool',
            primitiveId: inputData.primitiveId,
          },
        });
        return {
          task: inputData.task,
          primitiveId: inputData.primitiveId,
          primitiveType: inputData.primitiveType,
          result: 'Aborted',
          isComplete: true,
          iteration: inputData.iteration,
        };
      }

      const agentTools = await agent.listTools({ requestContext });
      const memory = await agent.getMemory({ requestContext });
      const memoryTools = await memory?.listTools?.();
      const clientTools = (await agent.getDefaultOptions({ requestContext }))?.clientTools;
      const toolsMap = { ...agentTools, ...memoryTools, ...(clientTools || {}) };

      let tool = toolsMap[inputData.primitiveId];

      if (!tool) {
        const mastraError = new MastraError({
          id: 'AGENT_NETWORK_TOOL_EXECUTION_STEP_INVALID_TASK_INPUT',
          domain: ErrorDomain.AGENT_NETWORK,
          category: ErrorCategory.USER,
          text: `Tool ${inputData.primitiveId} not found`,
        });

        // TODO pass agent logger in here
        // logger.trackException(mastraError);
        // logger.error(mastraError.toString());
        throw mastraError;
      }

      if (!tool.execute) {
        const mastraError = new MastraError({
          id: 'AGENT_NETWORK_TOOL_EXECUTION_STEP_INVALID_TASK_INPUT',
          domain: ErrorDomain.AGENT_NETWORK,
          category: ErrorCategory.USER,
          text: `Tool ${inputData.primitiveId} does not have an execute function`,
        });
        throw mastraError;
      }

      // @ts-expect-error - bad type
      const toolId = tool.id;
      // Use safeParseLLMJson to handle malformed JSON from LLM (truncated, unescaped chars, etc.)
      const inputDataToUse = await safeParseLLMJson(inputData.prompt);
      if (inputDataToUse === null) {
        logger?.warn(
          `Tool execution step received invalid JSON prompt for tool "${toolId}". ` +
            `Prompt was: "${inputData.prompt}". Returning error to routing agent for retry.`,
        );

        return {
          task: inputData.task,
          primitiveId: inputData.primitiveId,
          primitiveType: inputData.primitiveType,
          result:
            `Error: The prompt provided for tool "${toolId}" is not valid JSON. ` +
            `Received: "${inputData.prompt}". ` +
            `Tools require a valid JSON string matching their input schema. ` +
            `Please provide the prompt as properly formatted JSON (e.g., {"key": "value"}).`,
          isComplete: false,
          iteration: inputData.iteration,
        };
      }

      const toolCallId = generateId({
        idType: 'step',
        source: 'agent',
        entityId: toolId,
        stepType: 'tool-execution',
      });

      await writer?.write({
        type: 'tool-execution-start',
        payload: {
          args: {
            ...inputData,
            args: inputDataToUse,
            toolName: toolId,
            toolCallId,
          },
          runId,
        },
        from: ChunkFrom.NETWORK,
        runId,
      });

      // Check if approval is required
      // requireApproval can be:
      // - boolean (from Mastra createTool or mapped from AI SDK needsApproval: true)
      // - undefined (no approval needed)
      // If needsApprovalFn exists, evaluate it with the tool args
      let toolRequiresApproval = (tool as any).requireApproval;
      if ((tool as any).needsApprovalFn) {
        // Evaluate the function with the parsed args
        try {
          const needsApprovalResult = await (tool as any).needsApprovalFn(inputDataToUse);
          toolRequiresApproval = needsApprovalResult;
        } catch (error) {
          // Log error to help developers debug faulty needsApprovalFn implementations
          logger?.error(`Error evaluating needsApprovalFn for tool ${toolId}:`, error);
          // On error, default to requiring approval to be safe
          toolRequiresApproval = true;
        }
      }

      if (toolRequiresApproval) {
        if (!resumeData) {
          const requireApprovalResumeSchema = JSON.stringify(
            zodToJsonSchema(
              z.object({
                approved: z
                  .boolean()
                  .describe(
                    'Controls if the tool call is approved or not, should be true when approved and false when declined',
                  ),
              }),
            ),
          );
          await saveMessagesWithProcessors(
            memory,
            [
              {
                id: generateId(),
                type: 'text',
                role: 'assistant',
                content: {
                  parts: [
                    {
                      type: 'text',
                      text: JSON.stringify({
                        isNetwork: true,
                        selectionReason: inputData.selectionReason,
                        primitiveType: inputData.primitiveType,
                        primitiveId: inputData.primitiveId,
                        finalResult: { result: '', toolCallId },
                        input: inputDataToUse,
                      }),
                    },
                  ],
                  format: 2,
                  metadata: {
                    mode: 'network',
                    requireApprovalMetadata: {
                      [inputData.primitiveId]: {
                        toolCallId,
                        toolName: inputData.primitiveId,
                        args: inputDataToUse,
                        type: 'approval',
                        resumeSchema: requireApprovalResumeSchema,
                        runId,
                        primitiveType: 'tool',
                        primitiveId: inputData.primitiveId,
                      },
                    },
                  },
                },
                createdAt: new Date(),
                threadId: initData.threadId || runId,
                resourceId: initData.threadResourceId || networkName,
              },
            ] as MastraDBMessage[],
            processorRunner,
            { requestContext },
          );
          await writer?.write({
            type: 'tool-execution-approval',
            payload: {
              toolName: inputData.primitiveId,
              toolCallId,
              args: inputDataToUse,
              selectionReason: inputData.selectionReason,
              resumeSchema: requireApprovalResumeSchema,
              runId,
            },
          });

          return suspend({
            requireToolApproval: {
              toolName: inputData.primitiveId,
              args: inputDataToUse,
              toolCallId,
            },
          });
        } else {
          if (!resumeData.approved) {
            const rejectionResult = 'Tool call was not approved by the user';
            await saveMessagesWithProcessors(
              memory,
              [
                {
                  id: generateId(),
                  type: 'text',
                  role: 'assistant',
                  content: {
                    parts: [
                      {
                        type: 'text',
                        text: JSON.stringify({
                          isNetwork: true,
                          selectionReason: inputData.selectionReason,
                          primitiveType: inputData.primitiveType,
                          primitiveId: inputData.primitiveId,
                          finalResult: { result: rejectionResult, toolCallId },
                          input: inputDataToUse,
                        }),
                      },
                    ],
                    format: 2,
                    metadata: {
                      mode: 'network',
                    },
                  },
                  createdAt: new Date(),
                  threadId: initData.threadId || runId,
                  resourceId: initData.threadResourceId || networkName,
                },
              ] as MastraDBMessage[],
              processorRunner,
              { requestContext },
            );

            const endPayload = {
              task: inputData.task,
              primitiveId: inputData.primitiveId,
              primitiveType: inputData.primitiveType,
              result: rejectionResult,
              isComplete: false,
              iteration: inputData.iteration,
              toolCallId,
              toolName: toolId,
            };

            await writer?.write({
              type: 'tool-execution-end',
              payload: endPayload,
              from: ChunkFrom.NETWORK,
              runId,
            });

            return endPayload;
          }
        }
      }

      let toolSuspendPayload: any;

      const finalResult = await tool.execute(
        inputDataToUse,
        {
          abortSignal,
          requestContext,
          mastra: agent.getMastraInstance(),
          agent: {
            resourceId: initData.threadResourceId || networkName,
            toolCallId,
            threadId: initData.threadId,
            suspend: async (suspendPayload: any, suspendOptions?: SuspendOptions) => {
              await saveMessagesWithProcessors(
                memory,
                [
                  {
                    id: generateId(),
                    type: 'text',
                    role: 'assistant',
                    content: {
                      parts: [
                        {
                          type: 'text',
                          text: JSON.stringify({
                            isNetwork: true,
                            selectionReason: inputData.selectionReason,
                            primitiveType: inputData.primitiveType,
                            primitiveId: toolId,
                            finalResult: { result: '', toolCallId },
                            input: inputDataToUse,
                          }),
                        },
                      ],
                      format: 2,
                      metadata: {
                        mode: 'network',
                        suspendedTools: {
                          [inputData.primitiveId]: {
                            toolCallId,
                            toolName: inputData.primitiveId,
                            args: inputDataToUse,
                            suspendPayload,
                            type: 'suspension',
                            resumeSchema:
                              suspendOptions?.resumeSchema ??
                              JSON.stringify(zodToJsonSchema((tool as any).resumeSchema)),
                            runId,
                            primitiveType: 'tool',
                            primitiveId: inputData.primitiveId,
                          },
                        },
                      },
                    },
                    createdAt: new Date(),
                    threadId: initData.threadId || runId,
                    resourceId: initData.threadResourceId || networkName,
                  },
                ] as MastraDBMessage[],
                processorRunner,
                { requestContext },
              );
              await writer?.write({
                type: 'tool-execution-suspended',
                payload: {
                  toolName: inputData.primitiveId,
                  toolCallId,
                  args: inputDataToUse,
                  resumeSchema:
                    suspendOptions?.resumeSchema ?? JSON.stringify(zodToJsonSchema((tool as any).resumeSchema)),
                  suspendPayload,
                  runId,
                  selectionReason: inputData.selectionReason,
                },
              });

              toolSuspendPayload = suspendPayload;
            },
            resumeData,
          },
          runId,
          memory,
          context: inputDataToUse,
          // TODO: Pass proper tracing context when network supports tracing
          tracingContext: { currentSpan: undefined },
          writer,
        },
        { toolCallId, messages: [] },
      );

      if (toolSuspendPayload) {
        return await suspend({
          toolCallSuspended: toolSuspendPayload,
          toolName: inputData.primitiveId,
          args: inputDataToUse,
          toolCallId,
        });
      }

      if (abortSignal?.aborted) {
        await onAbort?.({
          primitiveType: 'tool',
          primitiveId: inputData.primitiveId,
          iteration: inputData.iteration,
        });
        await writer?.write({
          type: 'tool-execution-abort',
          runId,
          from: ChunkFrom.NETWORK,
          payload: {
            primitiveType: 'tool',
            primitiveId: inputData.primitiveId,
          },
        });
        await saveMessagesWithProcessors(
          memory,
          [
            {
              id: generateId({
                idType: 'message',
                source: 'agent',
                entityId: toolId,
                threadId: initData.threadId,
                resourceId: initData.threadResourceId || networkName,
                role: 'assistant',
              }),
              type: 'text',
              role: 'assistant',
              content: {
                parts: [
                  {
                    type: 'text',
                    text: JSON.stringify({
                      isNetwork: true,
                      selectionReason: inputData.selectionReason,
                      primitiveType: inputData.primitiveType,
                      primitiveId: toolId,
                      finalResult: { result: 'Aborted', toolCallId },
                      input: inputDataToUse,
                    }),
                  },
                ],
                format: 2,
                metadata: {
                  mode: 'network',
                },
              },
              createdAt: new Date(),
              threadId: initData.threadId || runId,
              resourceId: initData.threadResourceId || networkName,
            },
          ] as MastraDBMessage[],
          processorRunner,
          { requestContext },
        );
        return {
          task: inputData.task,
          primitiveId: inputData.primitiveId,
          primitiveType: inputData.primitiveType,
          result: 'Aborted',
          isComplete: true,
          iteration: inputData.iteration,
        };
      }

      await saveMessagesWithProcessors(
        memory,
        [
          {
            id: generateId({
              idType: 'message',
              source: 'agent',
              entityId: toolId,
              threadId: initData.threadId,
              resourceId: initData.threadResourceId || networkName,
              role: 'assistant',
            }),
            type: 'text',
            role: 'assistant',
            content: {
              parts: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    isNetwork: true,
                    selectionReason: inputData.selectionReason,
                    primitiveType: inputData.primitiveType,
                    primitiveId: toolId,
                    finalResult: { result: finalResult, toolCallId },
                    input: inputDataToUse,
                  }),
                },
              ],
              format: 2,
              metadata: {
                mode: 'network',
              },
            },
            createdAt: new Date(),
            threadId: initData.threadId || runId,
            resourceId: initData.threadResourceId || networkName,
          },
        ] as MastraDBMessage[],
        processorRunner,
        { requestContext },
      );

      const endPayload = {
        task: inputData.task,
        primitiveId: inputData.primitiveId,
        primitiveType: inputData.primitiveType,
        result: finalResult,
        isComplete: false,
        iteration: inputData.iteration,
        toolCallId,
        toolName: toolId,
      };

      await writer?.write({
        type: 'tool-execution-end',
        payload: endPayload,
        from: ChunkFrom.NETWORK,
        runId,
      });

      return endPayload;
    },
  });

  const finishStep = createStep({
    id: 'finish-step',
    inputSchema: z.object({
      task: z.string(),
      primitiveId: z.string(),
      primitiveType: PRIMITIVE_TYPES,
      prompt: z.string(),
      result: z.string(),
      isComplete: z.boolean().optional(),
      selectionReason: z.string(),
      iteration: z.number(),
      conversationContext: z.array(z.any()).optional(),
    }),
    outputSchema: z.object({
      task: z.string(),
      result: z.string(),
      isComplete: z.boolean(),
      iteration: z.number(),
    }),
    execute: async ({ inputData, writer }) => {
      let endResult = inputData.result;

      if (inputData.primitiveId === 'none' && inputData.primitiveType === 'none' && !inputData.result) {
        endResult = inputData.selectionReason;
      }

      const endPayload = {
        task: inputData.task,
        result: endResult,
        isComplete: !!inputData.isComplete,
        iteration: inputData.iteration,
        runId: runId,
      };

      await writer?.write({
        type: 'network-execution-event-step-finish',
        payload: endPayload,
        from: ChunkFrom.NETWORK,
        runId,
      });

      return endPayload;
    },
  });

  const networkWorkflow = createWorkflow({
    id: 'Agent-Network-Outer-Workflow',
    inputSchema: z.object({
      task: z.string(),
      primitiveId: z.string(),
      primitiveType: PRIMITIVE_TYPES,
      result: z.string().optional(),
      iteration: z.number(),
      threadId: z.string().optional(),
      threadResourceId: z.string().optional(),
      isOneOff: z.boolean(),
      verboseIntrospection: z.boolean(),
    }),
    outputSchema: z.object({
      task: z.string(),
      primitiveId: z.string(),
      primitiveType: PRIMITIVE_TYPES,
      prompt: z.string(),
      result: z.string(),
      isComplete: z.boolean().optional(),
      completionReason: z.string().optional(),
      iteration: z.number(),
      threadId: z.string().optional(),
      threadResourceId: z.string().optional(),
      isOneOff: z.boolean(),
    }),
    options: {
      shouldPersistSnapshot: ({ workflowStatus }) => workflowStatus === 'suspended',
      validateInputs: false,
    },
  });

  networkWorkflow
    .then(routingStep)
    .branch([
      [async ({ inputData }) => !inputData.isComplete && inputData.primitiveType === 'agent', agentStep],
      [async ({ inputData }) => !inputData.isComplete && inputData.primitiveType === 'workflow', workflowStep],
      [async ({ inputData }) => !inputData.isComplete && inputData.primitiveType === 'tool', toolStep],
      [async ({ inputData }) => !!inputData.isComplete, finishStep],
    ])
    .map({
      task: {
        step: [routingStep, agentStep, workflowStep, toolStep],
        path: 'task',
      },
      isComplete: {
        step: [agentStep, workflowStep, toolStep, finishStep],
        path: 'isComplete',
      },
      completionReason: {
        step: [routingStep, agentStep, workflowStep, toolStep, finishStep],
        path: 'completionReason',
      },
      result: {
        step: [agentStep, workflowStep, toolStep, finishStep],
        path: 'result',
      },
      primitiveId: {
        step: [routingStep, agentStep, workflowStep, toolStep],
        path: 'primitiveId',
      },
      primitiveType: {
        step: [routingStep, agentStep, workflowStep, toolStep],
        path: 'primitiveType',
      },
      iteration: {
        step: [routingStep, agentStep, workflowStep, toolStep],
        path: 'iteration',
      },
      isOneOff: {
        initData: networkWorkflow,
        path: 'isOneOff',
      },
      threadId: {
        initData: networkWorkflow,
        path: 'threadId',
      },
      threadResourceId: {
        initData: networkWorkflow,
        path: 'threadResourceId',
      },
    })
    .commit();

  return { networkWorkflow, processorRunner };
}

export async function networkLoop<OUTPUT = undefined>({
  networkName,
  requestContext,
  runId,
  routingAgent,
  routingAgentOptions,
  generateId,
  maxIterations,
  threadId,
  resourceId,
  messages,
  validation,
  routing,
  onIterationComplete,
  resumeData,
  autoResumeSuspendedTools,
  mastra,
  structuredOutput,
  onAbort,
  abortSignal,
}: {
  networkName: string;
  requestContext: RequestContext;
  runId: string;
  routingAgent: Agent<any, any, any, any>;
  routingAgentOptions?: AgentExecutionOptions<OUTPUT>;
  generateId: NetworkIdGenerator;
  maxIterations: number;
  threadId?: string;
  resourceId?: string;
  messages: MessageListInput;
  /**
   * Completion checks configuration.
   * When provided, runs checks to verify task completion.
   */
  validation?: CompletionConfig;
  /**
   * Optional routing configuration to customize primitive selection behavior.
   */
  routing?: {
    additionalInstructions?: string;
    verboseIntrospection?: boolean;
  };
  /**
   * Optional callback fired after each iteration completes.
   */
  onIterationComplete?: (context: {
    iteration: number;
    primitiveId: string;
    primitiveType: 'agent' | 'workflow' | 'tool' | 'none';
    result: string;
    isComplete: boolean;
  }) => void | Promise<void>;
  /**
   * Structured output configuration for the network's final result.
   * When provided, generates a structured response matching the schema.
   */
  structuredOutput?: OUTPUT extends {} ? StructuredOutputOptions<OUTPUT> : never;

  resumeData?: any;
  autoResumeSuspendedTools?: boolean;
  mastra?: Mastra;
  onAbort?: NetworkOptions<OUTPUT>['onAbort'];
  abortSignal?: NetworkOptions<OUTPUT>['abortSignal'];
}): Promise<MastraAgentNetworkStream<OUTPUT>> {
  // Validate that memory is available before starting the network
  const memoryToUse = await routingAgent.getMemory({ requestContext });

  if (!memoryToUse) {
    throw new MastraError({
      id: 'AGENT_NETWORK_MEMORY_REQUIRED',
      domain: ErrorDomain.AGENT_NETWORK,
      category: ErrorCategory.USER,
      text: 'Memory is required for the agent network to function properly. Please configure memory for the agent.',
      details: {
        status: 400,
      },
    });
  }

  const task = getLastMessage(messages);

  let resumeDataFromTask: any | undefined;
  let runIdFromTask: string | undefined;
  if (autoResumeSuspendedTools && threadId) {
    let lastAssistantMessage: MastraDBMessage | undefined;
    let requireApprovalMetadata: Record<string, any> | undefined;
    let suspendedTools: Record<string, any> | undefined;
    // get last assistant message from memory
    const memory = await routingAgent.getMemory({ requestContext });

    const threadExists = await memory?.getThreadById({ threadId });
    if (threadExists) {
      const recallResult = await memory?.recall({
        threadId: threadId,
        resourceId: resourceId || networkName,
      });

      if (recallResult && recallResult.messages?.length > 0) {
        const messages = [...recallResult.messages]?.reverse()?.filter(message => message.role === 'assistant');
        lastAssistantMessage = messages[0];
      }
      if (lastAssistantMessage) {
        const { metadata } = lastAssistantMessage.content;
        if (metadata?.requireApprovalMetadata) {
          requireApprovalMetadata = metadata.requireApprovalMetadata;
        }
        if (metadata?.suspendedTools) {
          suspendedTools = metadata.suspendedTools;
        }

        if (requireApprovalMetadata || suspendedTools) {
          const suspendedToolsArr = Object.values({ ...suspendedTools, ...requireApprovalMetadata });
          const firstSuspendedTool = suspendedToolsArr[0]; //only one primitive/tool gets suspended at a time, so there'll only be one item
          if (firstSuspendedTool.resumeSchema) {
            try {
              const llm = (await routingAgent.getLLM({ requestContext })) as MastraLLMVNext;
              const systemInstructions = `
            You are an assistant used to resume a suspended tool call.
            Your job is to construct the resumeData for the tool call using the messages available to you and the schema passed.
            You will generate an object that matches this schema: ${firstSuspendedTool.resumeSchema}.
            The resumeData generated should be a JSON value that is constructed from the messages, using the schema as guide. The JSON value is stringified.

            {
              "resumeData": "string"
            }
          `;
              const messageList = new MessageList();

              messageList.addSystem(systemInstructions);
              messageList.add(task, 'user');

              const result = llm.stream({
                methodType: 'generate',
                requestContext,
                messageList,
                agentId: routingAgent.id,
                tracingContext: routingAgentOptions?.tracingContext!,
                structuredOutput: {
                  schema: z.object({
                    resumeData: z.string(),
                  }),
                },
              });

              const object = await result.object;
              // Use safeParseLLMJson to handle malformed JSON from LLM
              const resumeDataFromLLM = await safeParseLLMJson(object.resumeData);
              if (
                resumeDataFromLLM !== null &&
                typeof resumeDataFromLLM === 'object' &&
                Object.keys(resumeDataFromLLM).length > 0
              ) {
                resumeDataFromTask = resumeDataFromLLM;
                runIdFromTask = firstSuspendedTool.runId;
              }
            } catch (error) {
              mastra?.getLogger()?.error(`Error generating resume data for network agent ${routingAgent.id}`, error);
            }
          }
        }
      }
    }
  }

  const runIdToUse = runIdFromTask ?? runId;
  const resumeDataToUse = resumeDataFromTask ?? resumeData;

  const { memory: routingAgentMemoryOptions, ...routingAgentOptionsWithoutMemory } = routingAgentOptions || {};

  const { networkWorkflow, processorRunner } = await createNetworkLoop({
    networkName,
    requestContext,
    runId: runIdToUse,
    agent: routingAgent,
    routingAgentOptions: routingAgentOptionsWithoutMemory,
    generateId,
    routing,
    onAbort,
    abortSignal,
  });

  // Validation step: runs external checks when LLM says task is complete
  // If validation fails, marks isComplete=false and adds feedback for next iteration
  const validationStep = createStep({
    id: 'validation-step',
    // @ts-expect-error - will be fixed by standard schema
    inputSchema: networkWorkflow.outputSchema,
    outputSchema: z.object({
      task: z.string(),
      primitiveId: z.string(),
      primitiveType: PRIMITIVE_TYPES,
      prompt: z.string(),
      result: z.string(),
      structuredObject: z.any().optional(),
      isComplete: z.boolean().optional(),
      completionReason: z.string().optional(),
      iteration: z.number(),
      validationPassed: z.boolean().optional(),
      validationFeedback: z.string().optional(),
    }),
    execute: async ({ inputData, writer }) => {
      const configuredScorers = validation?.scorers || [];

      // Build completion context
      const memory = await routingAgent.getMemory({ requestContext });
      const recallResult = memory
        ? await memory.recall({ threadId: inputData.threadId || runIdToUse })
        : { messages: [] };

      const completionContext: CompletionContext = {
        iteration: inputData.iteration,
        maxIterations,
        messages: recallResult.messages,
        originalTask: inputData.task,
        selectedPrimitive: {
          id: inputData.primitiveId,
          type: inputData.primitiveType,
        },
        primitivePrompt: inputData.prompt,
        primitiveResult: inputData.result,
        networkName,
        runId: runIdToUse,
        threadId: inputData.threadId,
        resourceId: inputData.threadResourceId,
        customContext: requestContext?.toJSON?.() as Record<string, unknown> | undefined,
      };

      // Determine which scorers to run
      const hasConfiguredScorers = configuredScorers.length > 0;

      await writer?.write({
        type: 'network-validation-start',
        payload: {
          runId: runIdToUse,
          iteration: inputData.iteration,
          checksCount: hasConfiguredScorers ? configuredScorers.length : 1,
        },
        from: ChunkFrom.NETWORK,
        runId,
      });

      // Run either configured scorers or the default LLM completion check
      let completionResult;
      let generatedFinalResult: string | undefined;
      let structuredObject: OUTPUT | undefined;

      if (inputData.result === 'Aborted') {
        completionResult = {
          complete: true,
          completionReason: 'Task aborted',
          scorers: [],
          totalDuration: 0,
          timedOut: false,
        };
      } else if (hasConfiguredScorers) {
        completionResult = await runValidation({ ...validation, scorers: configuredScorers }, completionContext);

        // Generate and stream finalResult if validation passed
        if (completionResult.complete) {
          const routingAgentToUse = await getRoutingAgent({
            requestContext,
            agent: routingAgent,
            routingConfig: routing,
          });

          // Use structured output generation if schema is provided
          if (structuredOutput?.schema) {
            const structuredResult = await generateStructuredFinalResult(
              routingAgentToUse,
              completionContext,
              structuredOutput,
              {
                writer,
                stepId: generateId(),
                runId: runIdToUse,
              },
              abortSignal,
              onAbort,
            );
            generatedFinalResult = structuredResult.text;
            structuredObject = structuredResult.object;
          } else {
            generatedFinalResult = await generateFinalResult(
              routingAgentToUse,
              completionContext,
              {
                writer,
                stepId: generateId(),
                runId: runIdToUse,
              },
              abortSignal,
              onAbort,
            );
          }

          // Save finalResult to memory if the LLM provided one
          await saveFinalResultIfProvided({
            memory: await routingAgent.getMemory({ requestContext }),
            finalResult: generatedFinalResult,
            threadId: inputData.threadId || runIdToUse,
            resourceId: inputData.threadResourceId || networkName,
            generateId,
            processorRunner,
            requestContext,
          });
        }
      } else {
        const routingAgentToUse = await getRoutingAgent({
          requestContext,
          agent: routingAgent,
          routingConfig: routing,
        });
        // Use the default LLM completion check
        const defaultResult = await runDefaultCompletionCheck(
          routingAgentToUse,
          completionContext,
          {
            writer,
            stepId: generateId(),
            runId: runIdToUse,
          },
          abortSignal,
          onAbort,
        );
        completionResult = {
          complete: defaultResult.passed,
          completionReason: defaultResult.reason,
          scorers: [defaultResult],
          totalDuration: defaultResult.duration,
          timedOut: false,
        };

        // Capture finalResult from default check
        generatedFinalResult = defaultResult.finalResult;

        // If completed and structured output is requested, generate it
        if (defaultResult.passed && structuredOutput?.schema) {
          const structuredResult = await generateStructuredFinalResult(
            routingAgentToUse,
            completionContext,
            structuredOutput,
            {
              writer,
              stepId: generateId(),
              runId,
            },
            abortSignal,
            onAbort,
          );
          if (structuredResult.text) {
            generatedFinalResult = structuredResult.text;
          }
          structuredObject = structuredResult.object;
        }

        // Save finalResult to memory if the LLM provided one
        if (defaultResult.passed) {
          await saveFinalResultIfProvided({
            memory: await routingAgent.getMemory({ requestContext }),
            finalResult: generatedFinalResult || defaultResult.finalResult,
            threadId: inputData.threadId || runIdToUse,
            resourceId: inputData.threadResourceId || networkName,
            generateId,
            processorRunner,
            requestContext,
          });
        }
      }

      const maxIterationReached = maxIterations && inputData.iteration >= maxIterations;

      await writer?.write({
        type: 'network-validation-end',
        payload: {
          runId,
          iteration: inputData.iteration,
          passed: completionResult.complete,
          results: completionResult.scorers,
          duration: completionResult.totalDuration,
          timedOut: completionResult.timedOut,
          reason: completionResult.completionReason,
          maxIterationReached: !!maxIterationReached,
        },
        from: ChunkFrom.NETWORK,
        runId: runIdToUse,
      });

      // Determine if this iteration completes the task
      const isComplete = completionResult.complete;

      // Fire the onIterationComplete callback if provided
      if (onIterationComplete) {
        await onIterationComplete({
          iteration: inputData.iteration,
          primitiveId: inputData.primitiveId,
          primitiveType: inputData.primitiveType,
          result: inputData.result,
          isComplete,
        });
      }

      // Format feedback (needed for return value even if not persisted)
      const feedback = formatCompletionFeedback(completionResult, !!maxIterationReached);

      // Not complete - inject feedback for next iteration (unless suppressed)
      if (!validation?.suppressFeedback) {
        // Save feedback to memory so the next iteration can see it
        const memoryInstance = await routingAgent.getMemory({ requestContext });
        await saveMessagesWithProcessors(
          memoryInstance,
          [
            {
              id: generateId(),
              type: 'text',
              role: 'assistant',
              content: {
                parts: [
                  {
                    type: 'text',
                    text: feedback,
                  },
                ],
                format: 2,
                metadata: {
                  mode: 'network',
                  completionResult: {
                    passed: completionResult.complete,
                  },
                },
              },
              createdAt: new Date(),
              threadId: inputData.threadId || runIdToUse,
              resourceId: inputData.threadResourceId || networkName,
            },
          ] as MastraDBMessage[],
          processorRunner,
          { requestContext },
        );
      }
      await new Promise(resolve => setTimeout(resolve, 10));

      if (isComplete) {
        // Task is complete - use generatedFinalResult if LLM provided one,
        // otherwise keep the primitive's result
        return {
          ...inputData,
          ...(generatedFinalResult ? { result: generatedFinalResult } : {}),
          ...(structuredObject !== undefined ? { structuredObject } : {}),
          isComplete: true,
          validationPassed: true,
          completionReason: completionResult.completionReason || 'Task complete',
        };
      } else {
        return {
          ...inputData,
          isComplete: false,
          validationPassed: false,
          validationFeedback: feedback,
        };
      }
    },
  });

  const finalStep = createStep({
    id: 'final-step',
    inputSchema: z.object({
      task: z.string(),
      primitiveId: z.string(),
      primitiveType: PRIMITIVE_TYPES,
      prompt: z.string(),
      result: z.string(),
      structuredObject: z.any().optional(),
      isComplete: z.boolean().optional(),
      completionReason: z.string().optional(),
      iteration: z.number(),
      validationPassed: z.boolean().optional(),
      validationFeedback: z.string().optional(),
    }),
    outputSchema: z.object({
      task: z.string(),
      primitiveId: z.string(),
      primitiveType: PRIMITIVE_TYPES,
      prompt: z.string(),
      result: z.string(),
      object: z.any().optional(),
      isComplete: z.boolean().optional(),
      completionReason: z.string().optional(),
      iteration: z.number(),
      validationPassed: z.boolean().optional(),
    }),
    execute: async ({ inputData, writer }) => {
      // Extract structuredObject and rename to object for the payload
      const { structuredObject, ...restInputData } = inputData;

      const finalData = {
        ...restInputData,
        ...(structuredObject !== undefined ? { object: structuredObject } : {}),
        ...(maxIterations && inputData.iteration >= maxIterations
          ? { completionReason: `Max iterations reached: ${maxIterations}` }
          : {}),
      };
      await writer?.write({
        type: 'network-execution-event-finish',
        payload: finalData,
        from: ChunkFrom.NETWORK,
        runId: runIdToUse,
      });

      return finalData;
    },
  });

  // Create a combined step that runs network iteration + validation
  const iterationWithValidation = createWorkflow({
    id: 'iteration-with-validation',
    inputSchema: networkWorkflow.inputSchema,
    outputSchema: validationStep.outputSchema,
    options: {
      shouldPersistSnapshot: ({ workflowStatus }) => workflowStatus === 'suspended',
      validateInputs: false,
    },
  })
    .then(networkWorkflow)
    .then(validationStep)
    .commit();

  const mainWorkflow = createWorkflow({
    id: 'agent-loop-main-workflow',
    inputSchema: z.object({
      iteration: z.number(),
      task: z.string(),
      primitiveId: z.string(),
      primitiveType: PRIMITIVE_TYPES,
      result: z.string().optional(),
      threadId: z.string().optional(),
      threadResourceId: z.string().optional(),
      isOneOff: z.boolean(),
      verboseIntrospection: z.boolean(),
    }),
    outputSchema: z.object({
      task: z.string(),
      primitiveId: z.string(),
      primitiveType: PRIMITIVE_TYPES,
      prompt: z.string(),
      result: z.string(),
      isComplete: z.boolean().optional(),
      completionReason: z.string().optional(),
      iteration: z.number(),
      validationPassed: z.boolean().optional(),
    }),
    options: {
      shouldPersistSnapshot: ({ workflowStatus }) => workflowStatus === 'suspended',
      validateInputs: false,
    },
  })
    .dountil(iterationWithValidation, async ({ inputData }) => {
      // Complete when: (LLM says complete AND validation passed) OR max iterations reached
      const llmComplete = inputData.isComplete === true;
      const validationOk = inputData.validationPassed !== false; // true or undefined (no validation)
      const maxReached = Boolean(maxIterations && inputData.iteration >= maxIterations);

      return (llmComplete && validationOk) || maxReached;
    })
    .then(finalStep)
    .commit();

  const mastraInstance = routingAgent.getMastraInstance();
  if (mastraInstance) {
    mainWorkflow.__registerMastra(mastraInstance);
    networkWorkflow.__registerMastra(mastraInstance);
  }

  const run = await mainWorkflow.createRun({
    runId: runIdToUse,
  });

  const { thread } = await prepareMemoryStep({
    requestContext: requestContext,
    threadId: threadId || run.runId,
    resourceId: resourceId || networkName,
    messages,
    routingAgent,
    generateId,
    tracingContext: routingAgentOptions?.tracingContext,
    memoryConfig: routingAgentMemoryOptions?.options,
  });

  return new MastraAgentNetworkStream({
    run,
    createStream: () => {
      if (resumeDataToUse) {
        return run.resumeStream({
          resumeData: resumeDataToUse,
          requestContext,
        }).fullStream;
      }
      return run.stream({
        inputData: {
          task,
          primitiveId: '',
          primitiveType: 'none',
          // Start at -1 so first iteration increments to 0 (not 1)
          iteration: -1,
          threadResourceId: thread?.resourceId,
          threadId: thread?.id,
          isOneOff: false,
          verboseIntrospection: true,
        },
        requestContext,
      }).fullStream;
    },
  });
}
