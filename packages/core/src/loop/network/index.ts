import type { JSONSchema7 } from 'json-schema';
import z from 'zod';
import type { ZodSchema } from 'zod';
import type { AgentExecutionOptions } from '../../agent';
import type { MultiPrimitiveExecutionOptions } from '../../agent/agent.types';
import { Agent } from '../../agent/index';
import { MessageList } from '../../agent/message-list';
import type { MastraMessageV2, MessageListInput } from '../../agent/message-list';
import type { RuntimeContext } from '../../runtime-context';
import type { OutputSchema } from '../../stream';
import { MastraAgentNetworkStream } from '../../stream/MastraAgentNetworkStream';
import { createStep, createWorkflow } from '../../workflows';
import { zodToJsonSchema } from '../../zod-to-json';
import { RESOURCE_TYPES } from '../types';

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

  const toolList = Object.entries(toolsToUse)
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
}: {
  threadId: string;
  resourceId: string;
  messages: MessageListInput;
  routingAgent: Agent;
  runtimeContext: RuntimeContext;
  generateId: () => string;
}) {
  const memory = await routingAgent.getMemory({ runtimeContext });
  let thread = await memory?.getThreadById({ threadId });
  if (!thread) {
    thread = await memory?.createThread({
      threadId,
      title: '',
      resourceId,
    });
  }
  if (typeof messages === 'string') {
    await memory?.saveMessages({
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
    });
  } else {
    const messageList = new MessageList({
      threadId: thread?.id,
      resourceId: thread?.resourceId,
    });
    messageList.add(messages, 'user');
    const messagesToSave = messageList.get.all.v2();

    await memory?.saveMessages({
      messages: messagesToSave,
      format: 'v2',
    });
  }

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
      resourceId: z.string(),
      resourceType: RESOURCE_TYPES,
      result: z.string().optional(),
      iteration: z.number(),
      threadId: z.string().optional(),
      threadResourceId: z.string().optional(),
      isOneOff: z.boolean(),
      verboseIntrospection: z.boolean(),
    }),
    outputSchema: z.object({
      task: z.string(),
      resourceId: z.string(),
      resourceType: RESOURCE_TYPES,
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

      let iterationCount = inputData.iteration ? inputData.iteration + 1 : 0;

      await writer.write({
        type: 'routing-agent-start',
        payload: {
          inputData: {
            ...inputData,
            iteration: iterationCount,
          },
        },
      });

      if (inputData.resourceType !== 'none' && inputData?.result) {
        const completionPrompt = `
                          The ${inputData.resourceType} ${inputData.resourceId} has contributed to the task.
                          This is the result from the agent: ${inputData.result}
  
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

        completionResult = await routingAgent.generateVNext([{ role: 'assistant', content: completionPrompt }], {
          output: completionSchema,
          runtimeContext: runtimeContext,
          maxSteps: 1,
          memory: {
            thread: initData?.threadId ?? runId,
            resource: initData?.threadResourceId ?? networkName,
            readOnly: true,
          },
          ...routingAgentOptions,
        });

        if (completionResult?.object?.isComplete) {
          const endPayload = {
            task: inputData.task,
            resourceId: '',
            resourceType: 'none' as z.infer<typeof RESOURCE_TYPES>,
            prompt: '',
            result: completionResult.object.finalResult,
            isComplete: true,
            selectionReason: completionResult.object.completionReason || '',
            iteration: iterationCount,
          };

          await writer.write({
            type: 'routing-agent-end',
            payload: endPayload,
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
                threadId: initData.threadId || runId,
                resourceId: initData.threadResourceId || networkName,
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
  
                    Please select the most appropriate primitive to handle this task and the prompt to be sent to the primitive.
                    If you are calling the same agent again, make sure to adjust the prompt to be more specific.
                    Make sure to not call the same primitive twice, unless you call it with different arguments and believe it adds something to the task completion criteria. Take into account previous decision making history and results in your decision making and final result. These are messages whose text is a JSON structure with "isNetwork" true.
  
                    {
                        "resourceId": string,
                        "resourceType": "agent" | "workflow" | "tool",
                        "prompt": string,
                        "selectionReason": string
                    }
  
                    The 'selectionReason' property should explain why you picked the primitive${inputData.verboseIntrospection ? ', as well as why the other primitives were not picked.' : '.'}
                    `,
        },
      ];

      const options = {
        output: z.object({
          resourceId: z.string(),
          resourceType: RESOURCE_TYPES,
          prompt: z.string(),
          selectionReason: z.string(),
        }),
        runtimeContext: runtimeContext,
        maxSteps: 1,
        memory: {
          thread: initData?.threadId ?? runId,
          resource: initData?.threadResourceId ?? networkName,
          readOnly: true,
        },
        ...routingAgentOptions,
      };

      const result = await routingAgent.generateVNext(prompt, options);

      const object = result.object;

      const endPayload = {
        task: inputData.task,
        result: '',
        resourceId: object.resourceId,
        resourceType: object.resourceType,
        prompt: object.prompt,
        isComplete: object.resourceId === 'none' && object.resourceType === 'none',
        selectionReason: object.selectionReason,
        iteration: iterationCount,
      };

      await writer.write({
        type: 'routing-agent-end',
        payload: endPayload,
      });

      return endPayload;
    },
  });

  const agentStep = createStep({
    id: 'agent-execution-step',
    inputSchema: z.object({
      task: z.string(),
      resourceId: z.string(),
      resourceType: RESOURCE_TYPES,
      prompt: z.string(),
      result: z.string(),
      isComplete: z.boolean().optional(),
      selectionReason: z.string(),
      iteration: z.number(),
    }),
    outputSchema: z.object({
      task: z.string(),
      resourceId: z.string(),
      resourceType: RESOURCE_TYPES,
      result: z.string(),
      isComplete: z.boolean().optional(),
      iteration: z.number(),
    }),
    execute: async ({ inputData, writer, getInitData }) => {
      const agentsMap = await agent.listAgents({ runtimeContext });

      const agentId = inputData.resourceId;

      const agentForStep = agentsMap[inputData.resourceId];

      if (!agentForStep) {
        throw new Error(`Agent ${agentId} not found`);
      }

      const runId = generateId();

      await writer.write({
        type: 'agent-execution-start',
        payload: {
          agentId: inputData.resourceId,
          args: inputData,
          runId,
        },
      });

      const result = await agentForStep.streamVNext(inputData.prompt, {
        // resourceId: inputData.resourceId,
        // threadId: inputData.threadId,
        runtimeContext: runtimeContext,
        runId,
      });

      for await (const chunk of result.fullStream) {
        await writer.write({
          type: `agent-execution-event-${chunk.type}`,
          payload: chunk,
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
                    resourceType: inputData.resourceType,
                    resourceId: inputData.resourceId,
                    input: inputData.prompt,
                    finalResult: { text: await result.text, toolCalls: await result.toolCalls, messages },
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
        agentId: inputData.resourceId,
        result: await result.text,
        isComplete: false,
        iteration: inputData.iteration,
      };

      await writer.write({
        type: 'agent-execution-end',
        payload: endPayload,
      });

      return {
        task: inputData.task,
        resourceId: inputData.resourceId,
        resourceType: inputData.resourceType,
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
      resourceId: z.string(),
      resourceType: RESOURCE_TYPES,
      prompt: z.string(),
      result: z.string(),
      isComplete: z.boolean().optional(),
      selectionReason: z.string(),
      iteration: z.number(),
    }),
    outputSchema: z.object({
      task: z.string(),
      resourceId: z.string(),
      resourceType: RESOURCE_TYPES,
      result: z.string(),
      isComplete: z.boolean().optional(),
      iteration: z.number(),
    }),
    execute: async ({ inputData, writer, getInitData }) => {
      const workflowsMap = await agent.getWorkflows({ runtimeContext: runtimeContext });
      const wf = workflowsMap[inputData.resourceId];

      if (!wf) {
        throw new Error(`Workflow ${inputData.resourceId} not found`);
      }

      let input;
      try {
        input = JSON.parse(inputData.prompt);
      } catch (e: unknown) {
        console.error(e);
        throw new Error(`Invalid task input: ${inputData.task}`);
      }

      const run = await wf.createRunAsync();
      const toolData = {
        name: wf.name,
        args: inputData,
        runId: run.runId,
      };

      await writer?.write({
        type: 'workflow-execution-start',
        payload: toolData,
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
      let chunks: any[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
        await writer?.write({
          type: `workflow-execution-event-${chunk.type}`,
          payload: chunk,
        });
      }

      let runSuccess = true;

      const workflowState = await stream.result;

      if (!workflowState?.status || workflowState?.status === 'failed') {
        runSuccess = false;
      }

      const finalResult = JSON.stringify({
        isNetwork: true,
        resourceType: inputData.resourceType,
        resourceId: inputData.resourceId,
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
            threadId: initData.threadId || runId,
            resourceId: initData.threadResourceId || networkName,
          },
        ] as MastraMessageV2[],
        format: 'v2',
      });

      const endPayload = {
        task: inputData.task,
        resourceId: inputData.resourceId,
        resourceType: inputData.resourceType,
        result: finalResult,
        isComplete: false,
        iteration: inputData.iteration,
      };

      await writer?.write({
        type: 'workflow-execution-end',
        payload: endPayload,
      });

      return endPayload;
    },
  });

  const toolStep = createStep({
    id: 'tool-execution-step',
    inputSchema: z.object({
      task: z.string(),
      resourceId: z.string(),
      resourceType: RESOURCE_TYPES,
      prompt: z.string(),
      result: z.string(),
      isComplete: z.boolean().optional(),
      selectionReason: z.string(),
      iteration: z.number(),
    }),
    outputSchema: z.object({
      task: z.string(),
      resourceId: z.string(),
      resourceType: RESOURCE_TYPES,
      result: z.string(),
      isComplete: z.boolean().optional(),
      iteration: z.number(),
    }),
    execute: async ({ inputData, getInitData, writer }) => {
      const toolsMap = await agent.getTools({ runtimeContext });
      const tool = toolsMap[inputData.resourceId];

      if (!tool) {
        throw new Error(`Tool ${inputData.resourceId} not found`);
      }

      if (!tool.execute) {
        throw new Error(`Tool ${inputData.resourceId} does not have an execute function`);
      }

      let inputDataToUse: any;
      try {
        inputDataToUse = JSON.parse(inputData.prompt);
      } catch (e: unknown) {
        console.error(e);
        throw new Error(`Invalid task input: ${inputData.task}`);
      }

      const toolCallId = generateId();

      await writer?.write({
        type: 'tool-execution-start',
        payload: {
          args: {
            ...inputData,
            args: inputDataToUse,
            toolName: inputData.resourceId,
            toolCallId,
          },
          runId,
        },
      });

      const finalResult: any = await tool.execute(
        {
          runtimeContext,
          mastra: agent.getMastraInstance(),
          resourceId: inputData.resourceId,
          threadId: runId,
          runId,
          context: inputDataToUse,
          // TODO: Pass proper tracing context when network supports tracing
          tracingContext: { currentSpan: undefined },
          writer,
        },
        { toolCallId, messages: [] },
      );

      const memory = await agent.getMemory({ runtimeContext: runtimeContext });
      const initData = await getInitData();
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
                    resourceType: inputData.resourceType,
                    resourceId: inputData.resourceId,
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
        resourceId: inputData.resourceId,
        resourceType: inputData.resourceType,
        result: finalResult,
        isComplete: false,
        iteration: inputData.iteration,
        toolCallId,
        toolName: inputData.resourceId,
      };

      await writer?.write({
        type: 'tool-execution-end',
        payload: endPayload,
      });

      return endPayload;
    },
  });

  const finishStep = createStep({
    id: 'finish-step',
    inputSchema: z.object({
      task: z.string(),
      resourceId: z.string(),
      resourceType: RESOURCE_TYPES,
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
      const endPayload = {
        task: inputData.task,
        result: inputData.result,
        isComplete: !!inputData.isComplete,
        iteration: inputData.iteration,
      };

      await writer?.write({
        type: 'network-execution-event-step-finish',
        payload: endPayload,
      });

      return endPayload;
    },
  });

  const networkWorkflow = createWorkflow({
    id: 'Agent-Network-Outer-Workflow',
    inputSchema: z.object({
      task: z.string(),
      resourceId: z.string(),
      resourceType: RESOURCE_TYPES,
      result: z.string().optional(),
      iteration: z.number(),
      threadId: z.string().optional(),
      threadResourceId: z.string().optional(),
      isOneOff: z.boolean(),
      verboseIntrospection: z.boolean(),
    }),
    outputSchema: z.object({
      task: z.string(),
      resourceId: z.string(),
      resourceType: RESOURCE_TYPES,
      prompt: z.string(),
      result: z.string(),
      isComplete: z.boolean().optional(),
      completionReason: z.string().optional(),
      iteration: z.number(),
      threadId: z.string().optional(),
      threadResourceId: z.string().optional(),
      isOneOff: z.boolean(),
    }),
  });

  networkWorkflow
    .then(routingStep)
    .branch([
      [async ({ inputData }) => !inputData.isComplete && inputData.resourceType === 'agent', agentStep],
      [async ({ inputData }) => !inputData.isComplete && inputData.resourceType === 'workflow', workflowStep],
      [async ({ inputData }) => !inputData.isComplete && inputData.resourceType === 'tool', toolStep],
      [async ({ inputData }) => inputData.isComplete, finishStep],
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
      resourceId: {
        step: [routingStep, agentStep, workflowStep, toolStep],
        path: 'resourceId',
      },
      resourceType: {
        step: [routingStep, agentStep, workflowStep, toolStep],
        path: 'resourceType',
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
  OUTPUT extends OutputSchema | undefined = undefined,
  STRUCTURED_OUTPUT extends ZodSchema | JSONSchema7 | undefined = undefined,
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
  routingAgentOptions?: AgentExecutionOptions<OUTPUT, STRUCTURED_OUTPUT, FORMAT>;
  generateId: () => string;
  maxIterations: number;
  threadId?: string;
  resourceId?: string;
  messages: MessageListInput;
}) {
  const { networkWorkflow } = await createNetworkLoop({
    networkName,
    runtimeContext,
    runId,
    agent: routingAgent,
    routingAgentOptions,
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
      resourceId: z.string(),
      resourceType: RESOURCE_TYPES,
      result: z.string().optional(),
      threadId: z.string().optional(),
      threadResourceId: z.string().optional(),
      isOneOff: z.boolean(),
      verboseIntrospection: z.boolean(),
    }),
    outputSchema: z.object({
      task: z.string(),
      resourceId: z.string(),
      resourceType: RESOURCE_TYPES,
      prompt: z.string(),
      result: z.string(),
      isComplete: z.boolean().optional(),
      completionReason: z.string().optional(),
      iteration: z.number(),
    }),
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
  });

  const task = getLastMessage(messages);

  return new MastraAgentNetworkStream({
    run,
    createStream: () => {
      return run.streamVNext({
        inputData: {
          task,
          resourceId: '',
          resourceType: 'none',
          iteration: 0,
          threadResourceId: thread?.resourceId,
          threadId: thread?.id,
          isOneOff: false,
          verboseIntrospection: true,
        },
      });
    },
  });
}
