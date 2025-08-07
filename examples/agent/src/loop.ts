import { createWorkflow, createStep } from '@mastra/core';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import type {
  LanguageModelV1FunctionTool,
  LanguageModelV1Message,
  LanguageModelV1ProviderDefinedTool,
} from '@ai-sdk/provider';
import { LanguageModel } from 'ai';
import { MastraAgentStream } from '@mastra/core/stream';
import { MessageList } from '@mastra/core/agent';

type Tool = LanguageModelV1FunctionTool & {
  execute: (inputData: any) => Promise<any>;
};

const model = openai('gpt-4o-mini');

class AgenticLoop {
  stepCount = 0;

  model: LanguageModel;

  tools: Array<Tool>;

  constructor({ model, tools }) {
    this.model = model;
    this.tools = tools;
  }

  toMessageList(messages: any[]) {
    const messageList = new MessageList();

    for (const message of messages) {
      let role;

      if (message.role === 'system') {
        messageList.addSystem(message.content);
        continue;
      }

      if (message.role === 'user') {
        role = 'user';
      } else {
        role = 'response';
      }

      messageList.add(message, role);
    }

    return messageList;
  }

  createToolCallStep() {
    const tools = this.tools;

    return createStep({
      id: 'toolCallStep',
      inputSchema: z.any(),
      outputSchema: z.any(),
      execute: async ({ inputData }) => {
        const tool = tools.find(tool => tool.name === inputData.toolName);

        if (!tool) {
          throw new Error(`Tool ${inputData.toolName} not found`);
        }

        const result = await tool.execute({ inputData: JSON.parse(inputData.args) });

        return { result, ...inputData };
      },
    });
  }

  createLLMStep({ writer }: { writer: WritableStreamDefaultWriter<any> }) {
    return createStep({
      id: 'generateText',
      inputSchema: z.any(),
      outputSchema: z.any(),
      execute: async ({ inputData, runId }) => {
        writer.write({
          type: 'step-start',
          request: {},
        });

        this.stepCount++;

        const messageList = this.toMessageList(inputData.messages || []);

        const agentStream = new MastraAgentStream({
          createStream: async () => {
            const stream = await model.doStream({
              inputFormat: 'messages',
              mode: {
                type: 'regular',
                tools: this.tools,
              },
              prompt: messageList.get.all.aiV4.model() as any,
            });

            return stream.stream as any;
          },
          getOptions: () => {
            return { runId };
          },
        });

        for await (const chunk of agentStream) {
          switch (chunk.type) {
            case 'finish':
              writer.write({
                ...chunk,
                ...chunk.payload,
                type: 'step-finish',
              });
              break;
            default:
              writer.write(chunk);
          }
        }

        const text = await agentStream.text;
        const toolCalls = await agentStream.toolCalls;
        const finishReason = await agentStream.finishReason;

        if (toolCalls.length > 0) {
          const userContent = [] as any[];

          if (text) {
            userContent.push({
              type: 'text',
              text: text,
            });
          }

          const assistantContent = [
            ...userContent,
            ...(toolCalls.map(toolCall => {
              return {
                type: 'tool-call',
                toolCallId: toolCall.toolCallId,
                toolName: toolCall.toolName,
                args: JSON.parse(toolCall.args),
              };
            }) as any),
          ];

          messageList.add(
            {
              role: 'assistant',
              content: assistantContent,
            },
            'response',
          );
        } else {
          messageList.add(
            {
              role: 'assistant',
              content: [{ type: 'text', text }],
            },
            'response',
          );
        }

        const messages = messageList.get.all.aiV4.model();

        const usage = await agentStream.usage;

        return {
          response: {
            finishReason,
            text,
            toolCalls,
            usage: {
              promptTokens: usage.promptTokens + (inputData.response?.usage?.promptTokens || 0),
              completionTokens: usage.completionTokens + (inputData.response?.usage?.completionTokens || 0),
              totalTokens: usage.promptTokens + usage.completionTokens + (inputData.response?.usage?.totalTokens || 0),
            },
          },
          messages,
        };
      },
    });
  }

  createExecutionWorkflow({ writer }: { writer: WritableStreamDefaultWriter<any> }) {
    const llmStep = this.createLLMStep({
      writer,
    });
    const toolCallStep = this.createToolCallStep();

    return createWorkflow({
      id: 'executionWorkflow',
      inputSchema: z.any(),
      outputSchema: z.any(),
    })
      .then(llmStep)
      .map(({ inputData }) => {
        return inputData.response.toolCalls || [];
      })
      .foreach(toolCallStep)
      .map(async ({ getStepResult, inputData }) => {
        const initialResult = getStepResult(llmStep);

        const messageList = this.toMessageList(initialResult.messages || []);

        if (inputData?.length) {
          messageList.add(
            {
              role: 'tool',
              content: inputData.map(toolCall => {
                return {
                  type: 'tool-result',
                  toolCallId: toolCall.toolCallId,
                  toolName: toolCall.toolName,
                  result: toolCall.result,
                };
              }),
            },
            'response',
          );
        }

        return {
          ...initialResult,
          messages: messageList.get.all.aiV4.model(),
        };
      })
      .commit();
  }

  async loop({ system, prompt, threadId, resourceId, maxSteps = 5, maxRetries = 3 }) {
    const messageList = new MessageList({
      threadId,
      resourceId,
    });

    messageList.addSystem(system);

    if (prompt) {
      messageList.add(prompt, 'user');
    }

    const messages = messageList.get.all.aiV5.model();

    const runId = crypto.randomUUID();

    const agentStream = new MastraAgentStream({
      getOptions: () => {
        return {
          runId: runId,
        };
      },
      createStream: async writer => {
        const readableStream = new ReadableStream({
          start: async controller => {
            const agentStreamWriter = writer.getWriter();

            const workflowStream = new WritableStream({
              write: chunk => {
                agentStreamWriter.write(chunk);
              },
            });

            const workflowStreamWriter = workflowStream.getWriter();

            const executionWorkflow = this.createExecutionWorkflow({
              writer: workflowStreamWriter,
            });

            const mainWorkflow = createWorkflow({
              id: 'agentic-loop',
              inputSchema: z.any(),
              outputSchema: z.any(),
              retryConfig: {
                attempts: maxRetries,
              },
            })
              .dowhile(executionWorkflow, async ({ inputData }) => {
                return inputData.response.finishReason !== 'stop' && this.stepCount < maxSteps;
              })
              .map(({ inputData }) => {
                const toolCalls = inputData.messages.filter(message => message.role === 'tool');

                inputData.response.toolCalls = toolCalls;

                return inputData;
              })

              .commit();

            const run = await mainWorkflow.createRunAsync({
              runId,
            });

            const executionResult = await run.start({
              inputData: {
                messages,
              },
            });

            if (executionResult.status !== 'success') {
              throw new Error('Execution failed');
            }

            workflowStreamWriter.write({
              type: 'finish',
              usage: executionResult.result.response.usage,
            });

            controller.close();
          },
        });

        return readableStream as any;
      },
    });

    return agentStream;
  }
}

// async function loop({
//     model,
//     tools,
//     toolChoice,
//     system,
//     prompt,
//     messages,
//     maxRetries,
//     abortSignal,
//     headers,
//     stopWhen,
//     experimental_output: output,
//     experimental_telemetry: telemetry,
//     prepareStep,
//     providerOptions,
//     experimental_activeTools,
//     activeTools = experimental_activeTools,
//     experimental_repairToolCall: repairToolCall,
//     experimental_transform: transform,
//     includeRawChunks = false,
//     onChunk,
//     onError = ({ error }) => {
//         console.error(error);
//     },
//     onFinish,
//     onAbort,
//     onStepFinish,
// }) {
//     let stepCount = 0

// }

// async function generateText({
//     prompt,
//     tools,
//     maxSteps = 3,
// }: {
//     prompt: string,
//     tools: any,
//     maxSteps?: number
// }) {

//     let stepCount = 0

//     const messages: LanguageModelV1Message[] = []

//     const step = createStep({
//         id: 'generateText',
//         inputSchema: z.any(),
//         outputSchema: z.any(),
//         execute: async ({ inputData }) => {
//             stepCount++

//             const prompt = messages.length > 0 ? messages : [{
//                 role: 'user',
//                 content: [{ type: 'text', text: inputData.prompt }]
//             }] as any

//             let response: any

//             try {
//                 response = await model.doGenerate({
//                     inputFormat: 'messages',
//                     mode: {
//                         type: 'regular',
//                         tools: tools,
//                     },
//                     prompt,
//                 })
//             } catch (error) {
//                 console.log(error)
//             }

//             console.log(response, 'RESPONSE')

//             messages.push({
//                 role: 'user',
//                 content: [{ type: 'text', text: inputData.prompt }]
//             })

//             if (response.toolCalls) {
//                 messages.push({
//                     role: 'assistant',
//                     content: [
//                         {
//                             type: 'text',
//                             text: response.text!
//                         },
//                         ...response.toolCalls.map((toolCall) => {
//                             return {
//                                 type: 'tool-call',
//                                 toolCallId: toolCall.toolCallId,
//                                 toolName: toolCall.toolName,
//                                 args: JSON.parse(toolCall.args),
//                             }
//                         }) as any
//                     ]
//                 })
//             } else {
//                 messages.push({
//                     role: 'assistant',
//                     content: [{ type: 'text', text: response.text! }]
//                 })
//             }

//             return response
//         }
//     })

//     const toolCallStep = createStep({
//         id: 'toolCallStep',
//         inputSchema: z.any(),
//         outputSchema: z.any(),
//         execute: async ({ inputData }) => {
//             const tool = tools.find((tool) => tool.name === inputData.toolName)

//             if (!tool) {
//                 throw new Error(`Tool ${inputData.toolName} not found`)
//             }

//             const result = await tool.execute({ inputData: JSON.parse(inputData.args) })

//             messages.push({
//                 role: 'tool',
//                 content: [{
//                     type: 'tool-result',
//                     toolCallId: inputData.toolCallId,
//                     toolName: inputData.toolName,
//                     result: result,
//                 }]
//             })

//             return result
//         }
//     })

//     const executionWorkflow = createWorkflow({
//         id: 'executionWorkflow',
//         inputSchema: z.any(),
//         outputSchema: z.any(),
//     })
//         .then(step)
//         .map(({ inputData }) => {
//             return inputData.toolCalls || []
//         })
//         .foreach(toolCallStep)
//         .map(async ({ getStepResult }) => {
//             const initialResult = getStepResult(step)
//             initialResult.messages = messages

//             console.log(initialResult)

//             return initialResult
//         })
//         .commit()

//     const workflow = createWorkflow({
//         id: 'generateText',
//         inputSchema: z.any(),
//         outputSchema: z.any(),
//     })
//         .dowhile(executionWorkflow, async ({ inputData }) => {
//             return inputData.finishReason !== 'stop' && stepCount < maxSteps
//         })

//         .commit()

//     const run = await workflow.createRunAsync()

//     const result = await run.start({
//         inputData: {
//             prompt: prompt,
//         }
//     })

//     console.log(result)
// }

const agenticLoop = new AgenticLoop({
  model: openai('gpt-4o-mini'),
  tools: [
    {
      name: 'myTool',
      description: 'myTool',
      type: 'function',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
          },
        },
      },
      execute: async ({ inputData }) => {
        return {
          name: inputData.name,
        };
      },
    },
  ],
});

const result = await agenticLoop.loop({
  system: 'You are a helpful assistant.',
  prompt: 'Call myTool with the name "John"',
  threadId: '123',
  resourceId: '456',
  maxSteps: 5,
});

for await (const chunk of result.textStream) {
  process.stdout.write(chunk ?? '');
}
