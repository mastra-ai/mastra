import z from 'zod';
import type { AgentExecutionOptions } from '../../agent';
import type { MultiPrimitiveExecutionOptions } from '../../agent/agent.types';
import { Agent, tryGenerateWithJsonFallback } from '../../agent/index';
import { MessageList } from '../../agent/message-list';
import type { MastraMessageV2, MessageListInput } from '../../agent/message-list';
import type { TracingContext } from '../../ai-tracing/types';
import { ErrorCategory, ErrorDomain, MastraError } from '../../error';
import type { RuntimeContext } from '../../runtime-context';
import { ChunkFrom } from '../../stream';
import type { ChunkType, OutputSchema } from '../../stream';
import { MastraAgentNetworkStream } from '../../stream/MastraAgentNetworkStream';
import { createStep, createWorkflow } from '../../workflows';
import { zodToJsonSchema } from '../../zod-to-json';
import { PRIMITIVE_TYPES } from '../types';

async function getRoutingAgent({ runtimeContext, agent }: { agent: Agent; runtimeContext: RuntimeContext }) {
  const instructionsToUse = await agent.getInstructions({ runtimeContext: runtimeContext });
  const agentsToUse = await agent.listAgents({ runtimeContext: runtimeContext });
  const workflowsToUse = await agent.getWorkflows({ runtimeContext: runtimeContext });
  const toolsToUse = await agent.getTools({ runtimeContext: runtimeContext });
  const model = await agent.getModel({ runtimeContext: runtimeContext });
  const memoryToUse = await agent.getMemory({ runtimeContext: runtimeContext });

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

  const memoryTools = await memoryToUse?.getTools?.();
  const toolList = Object.entries({ ...toolsToUse, ...memoryTools })
    .map(([name, tool]) => {
      return ` - **${name}**: ${tool.description}, input schema: ${JSON.stringify(
        zodToJsonSchema((tool as any).inputSchema || z.object({})),
      )}`;
    })
    .join('\n');

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
        `;

  return new Agent({
    name: 'routing-agent',
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
    } else if (lastMessage && `content` in lastMessage && lastMessage?.content) {
      const lastMessageContent = lastMessage.content;
      if (typeof lastMessageContent === 'string') {
        message = lastMessageContent;
      } else if (Array.isArray(lastMessageContent)) {
        const lastPart = lastMessageContent[lastMessageContent.length - 1];
        if (lastPart?.type === 'text') {
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
  runtimeContext,
  generateId,
  tracingContext,
  memoryConfig,
}: {
  threadId: string;
  resourceId: string;
  messages: MessageListInput;
  routingAgent: Agent;
  runtimeContext: RuntimeContext;
  generateId: () => string;
  tracingContext?: TracingContext;
  memoryConfig?: any;
}) {
  const memory = await routingAgent.getMemory({ runtimeContext });
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
          ] as MastraMessageV2[],
          format: 'v2',
        }),
      );
    }
  } else {
    const messageList = new MessageList({
      threadId: thread?.id,
      resourceId: thread?.resourceId,
    });
    messageList.add(messages, 'user');
    const messagesToSave = messageList.get.all.v2();

    if (memory) {
      promises.push(
        memory.saveMessages({
          messages: messagesToSave,
          format: 'v2',
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
    } = routingAgent.resolveTitleGenerationConfig(config?.threads?.generateTitle);

    if (shouldGenerate && userMessage) {
      promises.push(
        routingAgent
          .genTitle(
            userMessage,
            runtimeContext,
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

export async function createNetworkLoop({
  networkName,
  runtimeContext,
  runId,
  agent,
  generateId,
  routingAgentOptions,
}: {
  networkName: string;
  runtimeContext: RuntimeContext;
  runId: string;
  agent: Agent;
  routingAgentOptions?: Pick<MultiPrimitiveExecutionOptions, 'telemetry' | 'modelSettings'>;
  generateId: () => string;
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
    }),
    execute: async ({ inputData, getInitData, writer }) => {
      const initData = await getInitData();

      const completionSchema = z.object({
        isComplete: z.boolean(),
        finalResult: z.string(),
        completionReason: z.string(),
      });

      const routingAgent = await getRoutingAgent({ runtimeContext, agent });

      let completionResult;

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

      if (inputData.primitiveType !== 'none' && inputData?.result) {
        const completionPrompt = `
                          The ${inputData.primitiveType} ${inputData.primitiveId} has contributed to the task.
                          This is the result from the agent: ${typeof inputData.result === 'object' ? JSON.stringify(inputData.result) : inputData.result}
  
                          You need to evaluate that our task is complete. Pay very close attention to the SYSTEM INSTRUCTIONS for when the task is considered complete. Only return true if the task is complete according to the system instructions. Pay close attention to the finalResult and completionReason.
                          Original task: ${inputData.task}.

                          When generating the final result, make sure to take into account previous decision making history and results of all the previous iterations from conversation history. These are messages whose text is a JSON structure with "isNetwork" true.

                          You must return this JSON shape.
  
                          {
                              "isComplete": boolean,
                              "completionReason": string,
                              "finalResult": string
                          }
                      `;

        const streamOptions = {
          structuredOutput: {
            schema: completionSchema,
          },
          runtimeContext: runtimeContext,
          maxSteps: 1,
          memory: {
            thread: initData?.threadId ?? runId,
            resource: initData?.threadResourceId ?? networkName,
            readOnly: true,
          },
          ...routingAgentOptions,
        };

        // Try streaming with structured output
        let completionStream = await routingAgent.stream(completionPrompt, streamOptions);

        let currentText = '';
        let currentTextIdx = 0;
        await writer.write({
          type: 'routing-agent-text-start',
          payload: {
            runId: stepId,
          },
          from: ChunkFrom.NETWORK,
          runId,
        });

        // Stream and check for errors
        for await (const chunk of completionStream.objectStream) {
          if (chunk?.finalResult) {
            currentText = chunk.finalResult;
          }

          const currentSlice = currentText.slice(currentTextIdx);
          if (chunk?.isComplete && currentSlice.length) {
            await writer.write({
              type: 'routing-agent-text-delta',
              payload: {
                runId: stepId,
                text: currentSlice,
              },
              from: ChunkFrom.NETWORK,
              runId,
            });
            currentTextIdx = currentText.length;
          }
        }

        // If error detected, retry with JSON prompt injection fallback
        // TODO ujpdate tryStreamWithJsonFallback to not await the result so we can re-use it here
        if (completionStream.error) {
          console.warn('Error detected in structured output stream. Attempting fallback with JSON prompt injection.');

          // Reset text tracking for fallback
          currentText = '';
          currentTextIdx = 0;

          // Create fallback stream with jsonPromptInjection
          completionStream = await routingAgent.stream(completionPrompt, {
            ...streamOptions,
            structuredOutput: {
              ...streamOptions.structuredOutput,
              jsonPromptInjection: true,
            },
          });

          // Stream from fallback
          for await (const chunk of completionStream.objectStream) {
            if (chunk?.finalResult) {
              currentText = chunk.finalResult;
            }

            const currentSlice = currentText.slice(currentTextIdx);
            if (chunk?.isComplete && currentSlice.length) {
              await writer.write({
                type: 'routing-agent-text-delta',
                payload: {
                  runId: stepId,
                  text: currentSlice,
                },
                from: ChunkFrom.NETWORK,
                runId,
              });
              currentTextIdx = currentText.length;
            }
          }
        }

        completionResult = await completionStream.getFullOutput();

        if (completionResult?.object?.isComplete) {
          const endPayload = {
            task: inputData.task,
            primitiveId: '',
            primitiveType: 'none' as const,
            prompt: '',
            result: completionResult.object.finalResult,
            isComplete: true,
            selectionReason: completionResult.object.completionReason || '',
            iteration: iterationCount,
            runId: stepId,
          };

          await writer.write({
            type: 'routing-agent-end',
            payload: {
              ...endPayload,
              usage: await completionStream.usage,
            },
            from: ChunkFrom.NETWORK,
            runId,
          });

          const memory = await agent.getMemory({ runtimeContext: runtimeContext });
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
                      text: completionResult?.object?.finalResult || '',
                    },
                  ],
                  format: 2,
                },
                createdAt: new Date(),
                threadId: initData?.threadId || runId,
                resourceId: initData?.threadResourceId || networkName,
              },
            ] as MastraMessageV2[],
            format: 'v2',
          });

          return endPayload;
        }
      }

      const prompt: MessageListInput = [
        {
          role: 'assistant',
          content: `
                    ${inputData.isOneOff ? 'You are executing just one primitive based on the user task. Make sure to pick the primitive that is the best suited to accomplish the whole task. Primitives that execute only part of the task should be avoided.' : 'You will be calling just *one* primitive at a time to accomplish the user task, every call to you is one decision in the process of accomplishing the user task. Make sure to pick primitives that are the best suited to accomplish the whole task. Completeness is the highest priority.'}
  
                    The user has given you the following task: 
                    ${inputData.task}
                    ${completionResult ? `\n\n${completionResult?.object?.finalResult}` : ''}

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
        runtimeContext: runtimeContext,
        maxSteps: 1,
        memory: {
          thread: initData?.threadId ?? runId,
          resource: initData?.threadResourceId ?? networkName,
          readOnly: true,
        },
        ...routingAgentOptions,
      };

      const result = await tryGenerateWithJsonFallback(routingAgent, prompt, options);

      const object = result.object;

      const endPayload = {
        task: inputData.task,
        result: '',
        primitiveId: object.primitiveId,
        primitiveType: object.primitiveType,
        prompt: object.prompt,
        isComplete: object.primitiveId === 'none' && object.primitiveType === 'none',
        selectionReason: object.selectionReason,
        iteration: iterationCount,
        runId: stepId,
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
    }),
    outputSchema: z.object({
      task: z.string(),
      primitiveId: z.string(),
      primitiveType: PRIMITIVE_TYPES,
      result: z.string(),
      isComplete: z.boolean().optional(),
      iteration: z.number(),
    }),
    execute: async ({ inputData, writer, getInitData }) => {
      const agentsMap = await agent.listAgents({ runtimeContext });

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

      const result = await agentForStep.stream(inputData.prompt, {
        // resourceId: inputData.resourceId,
        // threadId: inputData.threadId,
        runtimeContext: runtimeContext,
        runId,
      });

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
      }

      const memory = await agent.getMemory({ runtimeContext: runtimeContext });

      const initData = await getInitData();
      const messages = result.messageList.get.all.v1();

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
                    finalResult: { text: await result.text, toolCalls: await result.toolCalls, messages },
                  }),
                },
              ],
              format: 2,
            },
            createdAt: new Date(),
            threadId: initData?.threadId || runId,
            resourceId: initData?.threadResourceId || networkName,
          },
        ] as MastraMessageV2[],
        format: 'v2',
      });

      const endPayload = {
        task: inputData.task,
        agentId,
        result: await result.text,
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
        result: await result.text,
        isComplete: false,
        iteration: inputData.iteration,
      };
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
    }),
    outputSchema: z.object({
      task: z.string(),
      primitiveId: z.string(),
      primitiveType: PRIMITIVE_TYPES,
      result: z.string(),
      isComplete: z.boolean().optional(),
      iteration: z.number(),
    }),
    execute: async ({ inputData, writer, getInitData }) => {
      const workflowsMap = await agent.getWorkflows({ runtimeContext: runtimeContext });
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

      const stepId = generateId();
      const run = await wf.createRunAsync({ runId });
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

      // await emitter.emit('watch-v2', {
      //     type: 'tool-call-streaming-start',
      //     ...toolData,
      // });

      const stream = run.streamVNext({
        inputData: input,
        runtimeContext: runtimeContext,
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

      const memory = await agent.getMemory({ runtimeContext: runtimeContext });
      const initData = await getInitData();
      await memory?.saveMessages({
        messages: [
          {
            id: generateId(),
            type: 'text',
            role: 'assistant',
            content: { parts: [{ type: 'text', text: finalResult }], format: 2 },
            createdAt: new Date(),
            threadId: initData?.threadId || runId,
            resourceId: initData?.threadResourceId || networkName,
          },
        ] as MastraMessageV2[],
        format: 'v2',
      });

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
    }),
    outputSchema: z.object({
      task: z.string(),
      primitiveId: z.string(),
      primitiveType: PRIMITIVE_TYPES,
      result: z.string(),
      isComplete: z.boolean().optional(),
      iteration: z.number(),
    }),
    execute: async ({ inputData, getInitData, writer }) => {
      const initData = await getInitData();

      const agentTools = await agent.getTools({ runtimeContext });
      const memory = await agent.getMemory({ runtimeContext });
      const memoryTools = await memory?.getTools?.();
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

      const finalResult = await tool.execute(
        {
          runtimeContext,
          mastra: agent.getMastraInstance(),
          resourceId: initData.threadResourceId || networkName,
          threadId: initData.threadId,
          runId,
          memory,
          context: inputDataToUse,
          // TODO: Pass proper tracing context when network supports tracing
          tracingContext: { currentSpan: undefined },
          writer,
        },
        { toolCallId, messages: [] },
      );

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
        ] as MastraMessageV2[],
        format: 'v2',
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

export async function networkLoop<
  OUTPUT extends OutputSchema = undefined,
  FORMAT extends 'aisdk' | 'mastra' | undefined = undefined,
>({
  networkName,
  runtimeContext,
  runId,
  routingAgent,
  routingAgentOptions,
  generateId,
  maxIterations,
  threadId,
  resourceId,
  messages,
}: {
  networkName: string;
  runtimeContext: RuntimeContext;
  runId: string;
  routingAgent: Agent;
  routingAgentOptions?: AgentExecutionOptions<OUTPUT, FORMAT>;
  generateId: () => string;
  maxIterations: number;
  threadId?: string;
  resourceId?: string;
  messages: MessageListInput;
}) {
  // Validate that memory is available before starting the network
  const memoryToUse = await routingAgent.getMemory({ runtimeContext });

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
    runtimeContext,
    runId,
    agent: routingAgent,
    routingAgentOptions: routingAgentOptionsWithoutMemory,
    generateId,
  });

  const finalStep = createStep({
    id: 'final-step',
    inputSchema: networkWorkflow.outputSchema,
    outputSchema: networkWorkflow.outputSchema,
    execute: async ({ inputData, writer }) => {
      if (maxIterations && inputData.iteration >= maxIterations) {
        await writer?.write({
          type: 'network-execution-event-finish',
          payload: {
            ...inputData,
            completionReason: `Max iterations reached: ${maxIterations}`,
          },
          from: ChunkFrom.NETWORK,
          runId,
        });
        return {
          ...inputData,
          completionReason: `Max iterations reached: ${maxIterations}`,
        };
      }

      return inputData;
    },
  });

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
    }),
    options: {
      shouldPersistSnapshot: ({ workflowStatus }) => workflowStatus === 'suspended',
    },
  })
    .dountil(networkWorkflow, async ({ inputData }) => {
      return inputData.isComplete || (maxIterations && inputData.iteration >= maxIterations);
    })
    .then(finalStep)
    .commit();

  const run = await mainWorkflow.createRunAsync({
    runId,
  });

  const { thread } = await prepareMemoryStep({
    runtimeContext: runtimeContext,
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
      return run.streamVNext({
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
