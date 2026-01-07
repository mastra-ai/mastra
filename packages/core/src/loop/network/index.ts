import z from 'zod';
import type { AgentExecutionOptions } from '../../agent';
import type { MultiPrimitiveExecutionOptions } from '../../agent/agent.types';
import { Agent, tryGenerateWithJsonFallback } from '../../agent/index';
import { MessageList } from '../../agent/message-list';
import type { MastraDBMessage, MessageListInput } from '../../agent/message-list';
import { ErrorCategory, ErrorDomain, MastraError } from '../../error';
import type { TracingContext } from '../../observability';
import type { RequestContext } from '../../request-context';
import { ChunkFrom } from '../../stream';
import type { ChunkType, OutputSchema } from '../../stream';
import { MastraAgentNetworkStream } from '../../stream/MastraAgentNetworkStream';
import { createStep, createWorkflow } from '../../workflows';
import type { Step } from '../../workflows';
import { zodToJsonSchema } from '../../zod-to-json';
import { PRIMITIVE_TYPES } from '../types';
import type { CompletionConfig, CompletionContext } from './validation';
import { runValidation, formatCompletionFeedback, runDefaultCompletionCheck, generateFinalResult } from './validation';

async function getRoutingAgent({
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

  const agentList = Object.entries(agentsToUse)
    .map(([name, agent]) => {
      // Use agent name instead of description since description might not exist
      return ` - **${name}**: ${agent.getDescription()}`;
    })
    .join('\n');

  const workflowList = Object.entries(workflowsToUse)
    .map(([name, workflow]) => {
      return ` - **${name}**: ${workflow.description}, input schema: ${JSON.stringify(
        zodToJsonSchema(workflow.inputSchema),
      )}`;
    })
    .join('\n');

  const memoryTools = await memoryToUse?.listTools?.();
  const toolList = Object.entries({ ...toolsToUse, ...memoryTools })
    .map(([name, tool]) => {
      return ` - **${name}**: ${tool.description}, input schema: ${JSON.stringify(
        zodToJsonSchema((tool as any).inputSchema || z.object({})),
      )}`;
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
    // @ts-ignore
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
  generateId: () => string;
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
              id: generateId(),
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
  if (thread?.title?.startsWith('New Thread') && memory) {
    const config = memory.getMergedThreadConfig(memoryConfig || {});

    const {
      shouldGenerate,
      model: titleModel,
      instructions: titleInstructions,
    } = routingAgent.resolveTitleGenerationConfig(config?.generateTitle);

    if (shouldGenerate && userMessage) {
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
async function saveFinalResultIfProvided({
  memory,
  finalResult,
  threadId,
  resourceId,
  generateId,
}: {
  memory: Awaited<ReturnType<Agent['getMemory']>>;
  finalResult: string | undefined;
  threadId: string;
  resourceId: string;
  generateId: () => string;
}) {
  if (memory && finalResult) {
    await memory.saveMessages({
      messages: [
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
    });
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
  autoResumeSuspendedTools,
}: {
  networkName: string;
  requestContext: RequestContext;
  runId: string;
  agent: Agent;
  routingAgentOptions?: Pick<MultiPrimitiveExecutionOptions, 'modelSettings'>;
  generateId: () => string;
  routing?: {
    additionalInstructions?: string;
    verboseIntrospection?: boolean;
  };
  autoResumeSuspendedTools?: boolean;
}) {
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
      suspendedToolRunId: z.string().optional().default(''),
      resumeData: z.any().optional(),
    }),
    execute: async ({ inputData, getInitData, writer }) => {
      const initData = await getInitData();

      const routingAgent = await getRoutingAgent({ requestContext, agent, routingConfig: routing });

      // Increment iteration counter. Must use nullish coalescing (??) not ternary (?)
      // to avoid treating 0 as falsy. Initial value is -1, so first iteration becomes 0.
      const iterationCount = (inputData.iteration ?? -1) + 1;

      const stepId = generateId();
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

      let lastAssistantMessage: MastraDBMessage | undefined;
      let requireApprovalMetadata: Record<string, any> | undefined;
      let suspendedTools: Record<string, any> | undefined;
      if (autoResumeSuspendedTools) {
        // get last assistant message from memory
        const memory = await routingAgent.getMemory({ requestContext });
        const recallResult = await memory?.recall({
          threadId: initData.threadId ?? runId,
          resourceId: initData?.threadResourceId ?? networkName,
        });
        if (recallResult && recallResult.messages?.length > 0) {
          const messages = [...recallResult.messages]?.filter(message => message.role === 'assistant');
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
        }
      }

      let suspendedToolsInstruction = '';

      if (requireApprovalMetadata || suspendedTools) {
        const suspendedToolsArr = Object.values({ ...suspendedTools, ...requireApprovalMetadata });
        suspendedToolsInstruction =
          suspendedToolsArr?.length > 0
            ? `
          Analyse the suspended primitives: ${JSON.stringify(suspendedToolsArr)}, using the messages available to you and the resumeSchema of each suspended primitive, find the tool whose resumeData you can construct properly.
          resumeData can not be an empty object nor null/undefined. 
          You will also find and use the previous prompt that was sent to the primitive in suspendedTool.args.
          The primitive type is available in suspendedTool.primitiveType and the primitive id is available in suspendedTool.primitiveId.
          When you find and call that primitive, add the resumeData to the JSON created
          Also, add the runId of the suspended tool as suspendedToolRunId to the JSON created.

          IMPORTANT: if you are unable to construct the resumeData from the messages available to you, do not send resumeData and suspendedToolRunId to the JSON created.
          If the suspendedTool.type is 'approval', resumeData will be an object that contains 'approved' which can either be true or false depending on the user's message. If you can't construct resumeData from the message for approval type, set approved to true and add resumeData: { approved: true } to the tool call arguments/input.
        `
            : '';
      }

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

                    ${suspendedToolsInstruction}

                    Please select the most appropriate primitive to handle this task and the prompt to be sent to the primitive. If no primitive is appropriate, return "none" for the primitiveId and "none" for the primitiveType.

                    {
                        "primitiveId": string,
                        "primitiveType": "agent" | "workflow" | "tool",
                        "prompt": string,
                        "selectionReason": string,
                        "suspendedToolRunId"?: string,
                        "resumeData"?: any
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
            suspendedToolRunId: z.string().describe('The runId of the suspended primitive').optional().default(''),
            resumeData: z
              .any()
              .describe('The resumeData object created from the resumeSchema of suspended primitive')
              .optional(),
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
      };

      const result = await tryGenerateWithJsonFallback(routingAgent, prompt, options);

      const object = result.object;

      const isComplete = object.primitiveId === 'none' && object.primitiveType === 'none';

      // When routing agent handles request itself (no delegation), emit text events
      if (isComplete && object.selectionReason) {
        await writer.write({
          type: 'routing-agent-text-start',
          payload: { runId: stepId },
          from: ChunkFrom.NETWORK,
          runId,
        });
        await writer.write({
          type: 'routing-agent-text-delta',
          payload: { runId: stepId, text: object.selectionReason },
          from: ChunkFrom.NETWORK,
          runId,
        });
      }

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
        suspendedToolRunId: object.suspendedToolRunId,
        resumeData: object.resumeData,
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
      suspendedToolRunId: z.string().optional().default(''),
      resumeData: z.any().optional(),
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
      const stepId = generateId();
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
      const initData = await getInitData();
      const threadId = initData?.threadId || runId;
      const resourceId = initData?.threadResourceId || networkName;

      const agentHasOwnMemory = agentForStep.hasOwnMemory();

      const resumeDataToUse = inputData.resumeData || resumeData;
      const suspendedToolRunIdToUse = inputData.suspendedToolRunId || runId;

      const result = await (resumeDataToUse
        ? agentForStep.resumeStream(resumeDataToUse, {
            requestContext: requestContext,
            runId: suspendedToolRunIdToUse,
            ...(agentHasOwnMemory
              ? {
                  memory: {
                    thread: threadId,
                    resource: resourceId,
                  },
                }
              : {}),
          })
        : agentForStep.stream(inputData.prompt, {
            requestContext: requestContext,
            runId,
            ...(agentHasOwnMemory
              ? {
                  memory: {
                    thread: threadId,
                    resource: resourceId,
                  },
                }
              : {}),
          }));

      let requireApprovalMetadata: Record<string, any> | undefined;
      let suspendedTools: Record<string, any> | undefined;

      let toolCallDeclined = false;

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
            [agentId]: {
              resumeSchema: chunk.payload.resumeSchema,
              toolCallId: chunk.payload.toolCallId,
              args: inputData.prompt,
              agentId,
              runId,
              type: 'approval',
              primitiveType: 'agent',
              primitiveId: agentId,
            },
          };
        }
        if (chunk.type === 'tool-call-suspended') {
          suspendedTools = {
            ...(suspendedTools ?? {}),
            [agentId]: {
              suspendPayload: chunk.payload.suspendPayload,
              resumeSchema: chunk.payload.resumeSchema,
              toolCallId: chunk.payload.toolCallId,
              args: inputData.prompt,
              agentId,
              runId,
              type: 'suspension',
              primitiveType: 'agent',
              primitiveId: agentId,
            },
          };
        }

        if (chunk.type === 'tool-result') {
          if (chunk.payload.result === 'Tool call was not approved by the user') {
            toolCallDeclined = true;
          }
        }
      }

      const memory = await agent.getMemory({ requestContext: requestContext });

      const messages = result.messageList.get.all.v1();

      let finalText = await result.text;
      if (toolCallDeclined) {
        finalText = finalText + '\n\nTool call was not approved by the user';
      }

      await memory?.saveMessages({
        messages: [
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
                    input: inputData.prompt,
                    finalResult: { text: finalText, messages },
                  }),
                },
              ],
              format: 2,
              ...(requireApprovalMetadata
                ? {
                    metadata: {
                      requireApprovalMetadata,
                    },
                  }
                : {}),
              ...(suspendedTools
                ? {
                    metadata: {
                      suspendedTools,
                    },
                  }
                : {}),
            },
            createdAt: new Date(),
            threadId: initData?.threadId || runId,
            resourceId: initData?.threadResourceId || networkName,
          },
        ] as MastraDBMessage[],
      });

      if (requireApprovalMetadata || suspendedTools) {
        await writer.write({
          type: requireApprovalMetadata ? 'agent-execution-approval' : 'agent-execution-suspended',
          payload: {
            args: inputData.prompt,
            agentId,
            runId: stepId,
            usage: await result.usage,
            selectionReason: inputData.selectionReason,
            ...(requireApprovalMetadata
              ? {
                  resumeSchema: requireApprovalMetadata[agentId].resumeSchema,
                }
              : {}),
            ...(suspendedTools
              ? {
                  resumeSchema: suspendedTools[agentId].resumeSchema,
                  suspendPayload: suspendedTools[agentId].suspendPayload,
                }
              : {}),
          },
          from: ChunkFrom.NETWORK,
          runId,
        });
        return await suspend({
          ...(requireApprovalMetadata ? { requireToolApproval: requireApprovalMetadata[agentId] } : {}),
          ...(suspendedTools
            ? {
                toolCallSuspended: suspendedTools[agentId].suspendPayload,
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
      suspendedToolRunId: z.string().optional().default(''),
      resumeData: z.any().optional(),
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

      let input;
      try {
        input = JSON.parse(inputData.prompt);
      } catch (e: unknown) {
        const mastraError = new MastraError(
          {
            id: 'WORKFLOW_EXECUTION_STEP_INVALID_TASK_INPUT',
            domain: ErrorDomain.AGENT_NETWORK,
            category: ErrorCategory.USER,
            text: `Invalid task input: ${inputData.task}`,
          },
          e,
        );

        // TODO pass agent logger in here
        // logger.trackException(mastraError);
        // logger.error(mastraError.toString());
        throw mastraError;
      }

      const resumeDataToUse = inputData.resumeData || resumeData;
      const runIdToUse = inputData.suspendedToolRunId || runId;

      const stepId = generateId();
      const run = await wf.createRun({ runId: runIdToUse });
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

      const stream = resumeDataToUse
        ? run.resumeStream({
            resumeData: resumeDataToUse,
            requestContext: requestContext,
          })
        : run.stream({
            inputData: input,
            requestContext: requestContext,
          });

      // let result: any;
      // let stepResults: Record<string, any> = {};
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
            if (!wf.steps[key]) {
              mastra?.getLogger()?.warn(`Suspended step '${key}' not found in workflow '${workflowId}'`);
              break;
            }
            wflowStep = wf.steps[key] as any;
          }
        }
        resumeSchema = (wflowStep as Step<any, any, any, any, any, any>)?.resumeSchema;
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
      const initData = await getInitData();
      await memory?.saveMessages({
        messages: [
          {
            id: generateId(),
            type: 'text',
            role: 'assistant',
            content: {
              parts: [{ type: 'text', text: finalResult }],
              format: 2,
              ...(suspendPayload
                ? {
                    metadata: {
                      suspendedTools: {
                        [workflowId]: {
                          args: input,
                          suspendPayload,
                          runId,
                          type: 'suspensions',
                          resumeSchema,
                          workflowId,
                          primitiveType: 'workflow',
                          primitiveId: workflowId,
                        },
                      },
                    },
                  }
                : {}),
            },
            createdAt: new Date(),
            threadId: initData?.threadId || runId,
            resourceId: initData?.threadResourceId || networkName,
          },
        ] as MastraDBMessage[],
      });

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
      suspendedToolRunId: z.string().optional().default(''),
      resumeData: z.any().optional(),
    }),
    outputSchema: z.object({
      task: z.string(),
      primitiveId: z.string(),
      primitiveType: PRIMITIVE_TYPES,
      result: z.string(),
      isComplete: z.boolean().optional(),
      iteration: z.number(),
    }),
    execute: async ({ inputData, getInitData, writer, resumeData, mastra, suspend }) => {
      const initData = await getInitData();
      const logger = mastra?.getLogger();

      const agentTools = await agent.listTools({ requestContext });
      const memory = await agent.getMemory({ requestContext });
      const memoryTools = await memory?.listTools?.();
      const toolsMap = { ...agentTools, ...memoryTools };

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
      let inputDataToUse: any;
      try {
        inputDataToUse = JSON.parse(inputData.prompt);
      } catch (e: unknown) {
        const mastraError = new MastraError(
          {
            id: 'AGENT_NETWORK_TOOL_EXECUTION_STEP_INVALID_TASK_INPUT',
            domain: ErrorDomain.AGENT_NETWORK,
            category: ErrorCategory.USER,
            text: `Invalid task input: ${inputData.task}`,
          },
          e,
        );
        // TODO pass agent logger in here
        // logger.trackException(mastraError);
        // logger.error(mastraError.toString());
        throw mastraError;
      }

      const toolCallId = generateId();

      const resumeDataToUse = inputData.resumeData || resumeData;

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
        if (!resumeDataToUse) {
          await memory?.saveMessages({
            messages: [
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
                    requireApprovalMetadata: {
                      [toolId]: {
                        toolCallId,
                        toolName: toolId,
                        args: inputDataToUse,
                        type: 'approval',
                        resumeSchema: z.object({
                          approved: z
                            .boolean()
                            .describe(
                              'Controls if the tool call is approved or not, should be true when approved and false when declined',
                            ),
                        }),
                        runId,
                        primitiveType: 'tool',
                        primitiveId: toolId,
                      },
                    },
                  },
                },
                createdAt: new Date(),
                threadId: initData.threadId || runId,
                resourceId: initData.threadResourceId || networkName,
              },
            ] as MastraDBMessage[],
          });
          await writer?.write({
            type: 'tool-execution-approval',
            payload: {
              toolName: toolId,
              toolCallId,
              args: inputDataToUse,
              selectionReason: inputData.selectionReason,
              resumeSchema: z.object({
                approved: z
                  .boolean()
                  .describe(
                    'Controls if the tool call is approved or not, should be true when approved and false when declined',
                  ),
              }),
              runId,
            },
          });

          return suspend({
            requireToolApproval: {
              toolName: toolId,
              args: inputDataToUse,
              toolCallId,
            },
          });
        } else {
          if (!resumeDataToUse.approved) {
            const rejectionResult = 'Tool call was not approved by the user';
            await memory?.saveMessages({
              messages: [
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
                          finalResult: { result: rejectionResult, toolCallId },
                          input: inputDataToUse,
                        }),
                      },
                    ],
                    format: 2,
                  },
                  createdAt: new Date(),
                  threadId: initData.threadId || runId,
                  resourceId: initData.threadResourceId || networkName,
                },
              ] as MastraDBMessage[],
            });

            const endPayload = {
              task: inputData.task,
              primitiveId: toolId,
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

      let toolSuspendPayload: any;

      const finalResult = await tool.execute(
        inputDataToUse,
        {
          requestContext,
          mastra: agent.getMastraInstance(),
          agent: {
            resourceId: initData.threadResourceId || networkName,
            toolCallId,
            threadId: initData.threadId,
            suspend: async (suspendPayload: any) => {
              await memory?.saveMessages({
                messages: [
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
                          [toolId]: {
                            toolCallId,
                            toolName: toolId,
                            args: inputDataToUse,
                            suspendPayload,
                            type: 'suspension',
                            resumeSchema: (tool as any).resumeSchema,
                            runId,
                            primitiveType: 'tool',
                            primitiveId: toolId,
                          },
                        },
                      },
                    },
                    createdAt: new Date(),
                    threadId: initData.threadId || runId,
                    resourceId: initData.threadResourceId || networkName,
                  },
                ] as MastraDBMessage[],
              });
              await writer?.write({
                type: 'tool-execution-suspended',
                payload: {
                  toolName: toolId,
                  toolCallId,
                  args: inputDataToUse,
                  resumeSchema: (tool as any).resumeSchema,
                  suspendPayload,
                  runId,
                  selectionReason: inputData.selectionReason,
                },
              });

              toolSuspendPayload = suspendPayload;
            },
            resumeData: resumeDataToUse,
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
          toolName: toolId,
          args: inputDataToUse,
          toolCallId,
        });
      }

      await memory?.saveMessages({
        messages: [
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
                    finalResult: { result: finalResult, toolCallId },
                    input: inputDataToUse,
                  }),
                },
              ],
              format: 2,
            },
            createdAt: new Date(),
            threadId: initData.threadId || runId,
            resourceId: initData.threadResourceId || networkName,
          },
        ] as MastraDBMessage[],
      });

      const endPayload = {
        task: inputData.task,
        primitiveId: toolId,
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
      suspendedToolRunId: z.string().optional().default(''),
      resumeData: z.any().optional(),
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

  return { networkWorkflow };
}

export async function networkLoop<OUTPUT extends OutputSchema = undefined>({
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
}: {
  networkName: string;
  requestContext: RequestContext;
  runId: string;
  routingAgent: Agent;
  routingAgentOptions?: AgentExecutionOptions<OUTPUT>;
  generateId: () => string;
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
  resumeData?: any;
  autoResumeSuspendedTools?: boolean;
}) {
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

  const { memory: routingAgentMemoryOptions, ...routingAgentOptionsWithoutMemory } = routingAgentOptions || {};

  const { networkWorkflow } = await createNetworkLoop({
    networkName,
    requestContext,
    runId,
    agent: routingAgent,
    routingAgentOptions: routingAgentOptionsWithoutMemory,
    generateId,
    routing,
    autoResumeSuspendedTools,
  });

  // Validation step: runs external checks when LLM says task is complete
  // If validation fails, marks isComplete=false and adds feedback for next iteration
  const validationStep = createStep({
    id: 'validation-step',
    inputSchema: networkWorkflow.outputSchema,
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
      validationFeedback: z.string().optional(),
    }),
    execute: async ({ inputData, writer }) => {
      const configuredScorers = validation?.scorers || [];

      // Build completion context
      const memory = await routingAgent.getMemory({ requestContext });
      const recallResult = memory ? await memory.recall({ threadId: inputData.threadId || runId }) : { messages: [] };

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
        runId,
        threadId: inputData.threadId,
        resourceId: inputData.threadResourceId,
        customContext: requestContext?.toJSON?.() as Record<string, unknown> | undefined,
      };

      // Determine which scorers to run
      const hasConfiguredScorers = configuredScorers.length > 0;

      await writer?.write({
        type: 'network-validation-start',
        payload: {
          runId,
          iteration: inputData.iteration,
          checksCount: hasConfiguredScorers ? configuredScorers.length : 1,
        },
        from: ChunkFrom.NETWORK,
        runId,
      });

      // Run either configured scorers or the default LLM completion check
      let completionResult;
      let generatedFinalResult: string | undefined;

      if (hasConfiguredScorers) {
        completionResult = await runValidation({ ...validation, scorers: configuredScorers }, completionContext);

        // Generate and stream finalResult if validation passed
        if (completionResult.complete) {
          const routingAgentToUse = await getRoutingAgent({
            requestContext,
            agent: routingAgent,
            routingConfig: routing,
          });
          generatedFinalResult = await generateFinalResult(routingAgentToUse, completionContext, {
            writer,
            stepId: generateId(),
            runId,
          });

          // Save finalResult to memory if the LLM provided one
          await saveFinalResultIfProvided({
            memory: await routingAgent.getMemory({ requestContext }),
            finalResult: generatedFinalResult,
            threadId: inputData.threadId || runId,
            resourceId: inputData.threadResourceId || networkName,
            generateId,
          });
        }
      } else {
        const routingAgentToUse = await getRoutingAgent({
          requestContext,
          agent: routingAgent,
          routingConfig: routing,
        });
        // Use the default LLM completion check
        const defaultResult = await runDefaultCompletionCheck(routingAgentToUse, completionContext, {
          writer,
          stepId: generateId(),
          runId,
        });
        completionResult = {
          complete: defaultResult.passed,
          completionReason: defaultResult.reason,
          scorers: [defaultResult],
          totalDuration: defaultResult.duration,
          timedOut: false,
        };

        // Capture finalResult from default check
        generatedFinalResult = defaultResult.finalResult;

        // Save finalResult to memory if the LLM provided one
        if (defaultResult.passed) {
          await saveFinalResultIfProvided({
            memory: await routingAgent.getMemory({ requestContext }),
            finalResult: defaultResult.finalResult,
            threadId: inputData.threadId || runId,
            resourceId: inputData.threadResourceId || networkName,
            generateId,
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
        runId,
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

      // Not complete - inject feedback for next iteration
      const feedback = formatCompletionFeedback(completionResult, !!maxIterationReached);

      // Save feedback to memory so the next iteration can see it
      const memoryInstance = await routingAgent.getMemory({ requestContext });
      if (memoryInstance) {
        await memoryInstance.saveMessages({
          messages: [
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
              threadId: inputData.threadId || runId,
              resourceId: inputData.threadResourceId || networkName,
            },
          ] as MastraDBMessage[],
        });
      }

      if (isComplete) {
        // Task is complete - use generatedFinalResult if LLM provided one,
        // otherwise keep the primitive's result
        return {
          ...inputData,
          ...(generatedFinalResult ? { result: generatedFinalResult } : {}),
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
      isComplete: z.boolean().optional(),
      completionReason: z.string().optional(),
      iteration: z.number(),
      validationPassed: z.boolean().optional(),
    }),
    execute: async ({ inputData, writer }) => {
      const finalData = {
        ...inputData,
        ...(maxIterations && inputData.iteration >= maxIterations
          ? { completionReason: `Max iterations reached: ${maxIterations}` }
          : {}),
      };
      await writer?.write({
        type: 'network-execution-event-finish',
        payload: finalData,
        from: ChunkFrom.NETWORK,
        runId,
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

  // Register mastra instance with workflows for storage access (needed for suspend/resume)
  const mastraInstance = routingAgent.getMastraInstance();
  if (mastraInstance) {
    mainWorkflow.__registerMastra(mastraInstance);
    networkWorkflow.__registerMastra(mastraInstance);
  }

  const run = await mainWorkflow.createRun({
    runId,
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

  const task = getLastMessage(messages);

  return new MastraAgentNetworkStream({
    run,
    createStream: () => {
      if (resumeData) {
        return run.resumeStream({
          resumeData,
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
      }).fullStream;
    },
  });
}
