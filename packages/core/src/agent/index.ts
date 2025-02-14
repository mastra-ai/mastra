import {
  type AssistantContent,
  type CoreAssistantMessage,
  type CoreMessage,
  type CoreToolMessage,
  type CoreUserMessage,
  type TextPart,
  type ToolCallPart,
  type UserContent,
} from 'ai';
import { type LanguageModelV1 } from 'ai';
import { randomUUID } from 'crypto';
import { type JSONSchema7 } from 'json-schema';
import { z, ZodSchema } from 'zod';

import { type MastraPrimitives } from '../action';
import { MastraBase } from '../base';
import { Metric } from '../eval';
import { AvailableHooks, executeHook } from '../hooks';
import type { GenerateReturn, StreamReturn } from '../llm';
import { MastraLLM, MastraLLMBase } from '../llm/model';
import { LogLevel, RegisteredLogger } from '../logger';
import { MastraMemory } from '../memory/memory';
import type { MemoryConfig, StorageThreadType } from '../memory/types';
import { InstrumentClass } from '../telemetry';
import { type CoreTool, type ToolAction } from '../tools/types';

import type { AgentConfig, AgentGenerateOptions, AgentStreamOptions, ToolsetsInput } from './types';

@InstrumentClass({
  prefix: 'agent',
  excludeMethods: ['__setTools', '__setLogger', '__setTelemetry', 'log'],
})
export class Agent<
  TTools extends Record<string, ToolAction<any, any, any, any>> = Record<string, ToolAction<any, any, any, any>>,
  TMetrics extends Record<string, Metric> = Record<string, Metric>,
> extends MastraBase {
  public name: string;
  readonly llm: MastraLLMBase;
  instructions: string;
  readonly model?: LanguageModelV1;
  #mastra?: MastraPrimitives;
  #memory?: MastraMemory;
  tools: TTools;
  /** @deprecated This property is deprecated. Use evals instead. */
  metrics: TMetrics;
  evals: TMetrics;

  constructor(config: AgentConfig<TTools, TMetrics>) {
    super({ component: RegisteredLogger.AGENT });

    this.name = config.name;
    this.instructions = config.instructions;

    if (!config.model) {
      throw new Error(`LanugageModel is required to create an Agent. Please provider the 'model'.`);
    }

    this.llm = new MastraLLM({ model: config.model });

    this.tools = {} as TTools;

    this.metrics = {} as TMetrics;
    this.evals = {} as TMetrics;

    if (config.tools) {
      this.tools = config.tools;
    }

    if (config.mastra) {
      this.#mastra = config.mastra;
    }

    if (config.metrics) {
      this.logger.warn('The metrics property is deprecated. Please use evals instead to add evaluation metrics.');
      this.metrics = config.metrics;
      // Set evals to metrics
      this.evals = config.metrics;
    }

    if (config.evals) {
      this.evals = config.evals;
    }

    if (config.memory) {
      this.#memory = config.memory;
    }
  }

  public hasOwnMemory(): boolean {
    return Boolean(this.#memory);
  }
  public getMemory(): MastraMemory | undefined {
    return this.#memory ?? this.#mastra?.memory;
  }

  __updateInstructions(newInstructions: string) {
    this.instructions = newInstructions;
    this.logger.debug(`[Agents:${this.name}] Instructions updated.`, { model: this.model, name: this.name });
  }

  __registerPrimitives(p: MastraPrimitives) {
    if (p.telemetry) {
      this.__setTelemetry(p.telemetry);
    }

    if (p.logger) {
      this.__setLogger(p.logger);
    }

    this.llm.__registerPrimitives(p);

    this.#mastra = p;

    this.logger.debug(`[Agents:${this.name}] initialized.`, { model: this.model, name: this.name });
  }

  /**
   * Set the concrete tools for the agent
   * @param tools
   */
  __setTools(tools: TTools) {
    this.tools = tools;
    this.logger.debug(`[Agents:${this.name}] Tools set for agent ${this.name}`, { model: this.model, name: this.name });
  }

  async generateTitleFromUserMessage({ message }: { message: CoreUserMessage }) {
    const { object } = await this.llm.__textObject<{ title: string }>({
      messages: [
        {
          role: 'system',
          content: `\n
      - you will generate a short title based on the first message a user begins a conversation with
      - ensure it is not more than 80 characters long
      - the title should be a summary of the user's message
      - do not use quotes or colons`,
        },
        {
          role: 'user',
          content: JSON.stringify(message),
        },
      ],
      structuredOutput: z.object({
        title: z.string(),
      }),
    });

    return object.title;
  }

  getMostRecentUserMessage(messages: Array<CoreMessage>) {
    const userMessages = messages.filter(message => message.role === 'user');
    return userMessages.at(-1);
  }

  async genTitle(userMessage: CoreUserMessage | undefined) {
    let title = 'New Thread';
    try {
      if (userMessage) {
        title = await this.generateTitleFromUserMessage({
          message: userMessage,
        });
      }
    } catch (e) {
      console.error('Error generating title:', e);
    }
    return title;
  }

  async saveMemory({
    threadId,
    memoryConfig,
    resourceId,
    userMessages,
    runId,
  }: {
    resourceId: string;
    threadId?: string;
    memoryConfig?: MemoryConfig;
    userMessages: CoreMessage[];
    time?: Date;
    keyword?: string;
    runId?: string;
  }) {
    const userMessage = this.getMostRecentUserMessage(userMessages);
    const memory = this.getMemory();
    if (memory) {
      let thread: StorageThreadType | null;
      if (!threadId) {
        this.logger.debug(`No threadId, creating new thread for agent ${this.name}`, {
          runId: runId || this.name,
        });
        const title = await this.genTitle(userMessage);

        thread = await memory.createThread({
          threadId,
          resourceId,
          title,
          memoryConfig,
        });
      } else {
        thread = await memory.getThreadById({ threadId });
        if (!thread) {
          this.logger.debug(`Thread with id ${threadId} not found, creating new thread for agent ${this.name}`, {
            runId: runId || this.name,
          });
          const title = await this.genTitle(userMessage);
          thread = await memory.createThread({
            threadId,
            resourceId,
            title,
            memoryConfig,
          });
        }
      }

      const newMessages = userMessage ? [userMessage] : userMessages;

      if (thread) {
        const messages = newMessages.map(u => {
          return {
            id: this.getMemory()?.generateId()!,
            createdAt: new Date(),
            threadId: thread.id,
            ...u,
            content: u.content as UserContent | AssistantContent,
            role: u.role as 'user' | 'assistant',
            type: 'text' as 'text' | 'tool-call' | 'tool-result',
          };
        });

        const memoryMessages =
          threadId && memory
            ? (
                await memory.rememberMessages({
                  threadId,
                  config: memoryConfig,
                  vectorMessageSearch: messages
                    .slice(-1)
                    .map(m => {
                      if (typeof m === `string`) {
                        return m;
                      }
                      return m?.content || ``;
                    })
                    .join(`\n`),
                })
              ).messages
            : [];

        if (memory) {
          await memory.saveMessages({ messages, memoryConfig });
        }

        this.log(LogLevel.DEBUG, 'Saved messages to memory', {
          threadId: thread.id,
          runId,
        });

        const memorySystemMessage =
          memory && threadId ? await memory.getSystemMessage({ threadId, memoryConfig }) : null;

        return {
          threadId: thread.id,
          messages: [
            {
              role: 'system',
              content: `\n
             Analyze this message to determine if the user is referring to a previous conversation with the LLM.
             Specifically, identify if the user wants to reference specific information from that chat or if they want the LLM to use the previous chat messages as context for the current conversation.
             Extract any date ranges mentioned in the user message that could help identify the previous chat.
             Return dates in ISO format.
             If no specific dates are mentioned but time periods are (like "last week" or "past month"), calculate the appropriate date range.
             For the end date, return the date 1 day after the end of the time period.
             Today's date is ${new Date().toISOString()} and the time is ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true })} ${memorySystemMessage ? `\n\n${memorySystemMessage}` : ''}`,
            } as any,
            ...memoryMessages,
            ...newMessages,
          ],
        };
      }

      return {
        threadId: (thread as StorageThreadType)?.id || threadId || '',
        messages: userMessages,
      };
    }

    return { threadId: threadId || '', messages: userMessages };
  }

  async saveResponse({
    result,
    threadId,
    resourceId,
    runId,
    memoryConfig,
  }: {
    runId: string;
    resourceId: string;
    result: Record<string, any>;
    threadId: string;
    memoryConfig: MemoryConfig | undefined;
  }) {
    const { response } = result;
    try {
      if (response.messages) {
        const ms = Array.isArray(response.messages) ? response.messages : [response.messages];

        const responseMessagesWithoutIncompleteToolCalls = this.sanitizeResponseMessages(ms);

        const memory = this.getMemory();

        if (memory) {
          this.logger.debug(
            `[Agent:${this.name}] - Memory persistence: store=${this.getMemory()?.constructor.name} threadId=${threadId}`,
            {
              runId,
              resourceId,
              threadId,
              memoryStore: this.getMemory()?.constructor.name,
            },
          );

          await memory.saveMessages({
            memoryConfig,
            messages: responseMessagesWithoutIncompleteToolCalls.map((message: CoreMessage | CoreAssistantMessage) => {
              const messageId = randomUUID();
              let toolCallIds: string[] | undefined;
              let toolCallArgs: Record<string, unknown>[] | undefined;
              let toolNames: string[] | undefined;
              let type: 'text' | 'tool-call' | 'tool-result' = 'text';

              if (message.role === 'tool') {
                toolCallIds = (message as CoreToolMessage).content.map(content => content.toolCallId);
                type = 'tool-result';
              }
              if (message.role === 'assistant') {
                const assistantContent = (message as CoreAssistantMessage).content as Array<TextPart | ToolCallPart>;

                const assistantToolCalls = assistantContent
                  .map(content => {
                    if (content.type === 'tool-call') {
                      return {
                        toolCallId: content.toolCallId,
                        toolArgs: content.args,
                        toolName: content.toolName,
                      };
                    }
                    return undefined;
                  })
                  ?.filter(Boolean) as Array<{
                  toolCallId: string;
                  toolArgs: Record<string, unknown>;
                  toolName: string;
                }>;

                toolCallIds = assistantToolCalls?.map(toolCall => toolCall.toolCallId);

                toolCallArgs = assistantToolCalls?.map(toolCall => toolCall.toolArgs);
                toolNames = assistantToolCalls?.map(toolCall => toolCall.toolName);
                type = assistantContent?.[0]?.type as 'text' | 'tool-call' | 'tool-result';
              }

              return {
                id: messageId,
                threadId: threadId,
                role: message.role as any,
                content: message.content as any,
                createdAt: new Date(),
                toolCallIds: toolCallIds?.length ? toolCallIds : undefined,
                toolCallArgs: toolCallArgs?.length ? toolCallArgs : undefined,
                toolNames: toolNames?.length ? toolNames : undefined,
                type,
              };
            }),
          });
        }
      }
    } catch (err) {
      this.logger.error(`[Agent:${this.name}] - Failed to save assistant response`, {
        error: err,
        runId: runId,
      });
    }
  }

  sanitizeResponseMessages(
    messages: Array<CoreToolMessage | CoreAssistantMessage>,
  ): Array<CoreToolMessage | CoreAssistantMessage> {
    let toolResultIds: Array<string> = [];

    for (const message of messages) {
      if (message.role === 'tool') {
        for (const content of message.content) {
          if (content.type === 'tool-result') {
            toolResultIds.push(content.toolCallId);
          }
        }
      }
    }

    const messagesBySanitizedContent = messages.map(message => {
      if (message.role !== 'assistant') return message;

      if (typeof message.content === 'string') return message;

      const sanitizedContent = message.content.filter(content =>
        content.type === 'tool-call'
          ? toolResultIds.includes(content.toolCallId)
          : content.type === 'text'
            ? content.text.length > 0
            : true,
      );

      return {
        ...message,
        content: sanitizedContent,
      };
    });

    return messagesBySanitizedContent.filter(message => message.content.length > 0);
  }

  convertTools({
    toolsets,
    // threadId,
    runId,
  }: {
    toolsets?: ToolsetsInput;
    threadId?: string;
    runId?: string;
  }): Record<string, CoreTool> {
    this.logger.debug(`[Agents:${this.name}] - Assigning tools`, { runId });
    const converted = Object.entries(this.tools || {}).reduce(
      (memo, value) => {
        const k = value[0];
        const tool = this.tools[k];

        if (tool) {
          memo[k] = {
            description: tool.description,
            parameters: tool.inputSchema,
            execute: async args => {
              // TODO: tool call cache should be on storage classes, not memory
              // if (threadId && tool.enableCache && this.#mastra?.memory) {
              //   const cachedResult = await this.#mastra.memory.getToolResult({
              //     threadId,
              //     toolArgs: args,
              //     toolName: k as string,
              //   });
              //   if (cachedResult) {
              //     this.logger.debug(`Cached Result ${k as string} runId: ${runId}`, {
              //       cachedResult: JSON.stringify(cachedResult, null, 2),
              //       runId,
              //     });
              //     return cachedResult;
              //   }
              // }
              // this.logger.debug(`Cache not found or not enabled, executing tool runId: ${runId}`, {
              //   runId,
              // });

              try {
                this.logger.debug(`[Agent:${this.name}] - Executing tool ${k}`, {
                  name: k,
                  description: tool.description,
                  args,
                });
                return tool.execute({
                  context: args,
                  mastra: this.#mastra,
                });
              } catch (err) {
                this.logger.error(`[Agent:${this.name}] - Failed execution`, {
                  error: err,
                  runId: runId,
                });
                throw err;
              }
            },
          };
        }
        return memo;
      },
      {} as Record<string, CoreTool>,
    );

    const toolsFromToolsetsConverted: Record<string, CoreTool> = {
      ...converted,
    };

    const toolsFromToolsets = Object.values(toolsets || {});

    if (toolsFromToolsets.length > 0) {
      this.logger.debug(`[Agent:${this.name}] - Adding tools from toolsets ${Object.keys(toolsets || {}).join(', ')}`, {
        runId,
      });
      toolsFromToolsets.forEach(toolset => {
        Object.entries(toolset).forEach(([toolName, tool]) => {
          const toolObj = tool;
          toolsFromToolsetsConverted[toolName] = {
            description: toolObj.description || '',
            parameters: toolObj.inputSchema,
            execute: async args => {
              // TODO: tool call cache should be on storage classes, not memory
              // if (threadId && toolObj.enableCache && this.#mastra?.memory) {
              //   const cachedResult = await this.#mastra.memory.getToolResult({
              //     threadId,
              //     toolArgs: args,
              //     toolName,
              //   });
              //   if (cachedResult) {
              //     this.logger.debug(`Cached Result ${toolName as string} runId: ${runId}`, {
              //       cachedResult: JSON.stringify(cachedResult, null, 2),
              //       runId,
              //     });
              //     return cachedResult;
              //   }
              // }
              // this.logger.debug(`Cache not found or not enabled, executing tool runId: ${runId}`, {
              //   runId,
              // });

              try {
                this.logger.debug(`[Agent:${this.name}] - Executing tool ${toolName}`, {
                  name: toolName,
                  description: toolObj.description,
                  args,
                });
                return toolObj.execute!({
                  context: args,
                });
              } catch (err) {
                this.logger.error(`[Agent:${this.name}] - Failed toolset execution`, {
                  error: err,
                  runId: runId,
                });
                throw err;
              }
            },
          };
        });
      });
    }

    return toolsFromToolsetsConverted;
  }

  async preExecute({
    resourceId,
    runId,
    threadId,
    memoryConfig,
    messages,
  }: {
    runId?: string;
    threadId?: string;
    memoryConfig?: MemoryConfig;
    messages: CoreMessage[];
    resourceId: string;
  }) {
    let coreMessages: CoreMessage[] = [];
    let threadIdToUse = threadId;

    this.log(LogLevel.INFO, `Saving user messages in memory for agent ${this.name}`, { runId });
    const saveMessageResponse = await this.saveMemory({
      threadId,
      resourceId,
      userMessages: messages,
      memoryConfig,
    });

    coreMessages = saveMessageResponse.messages;
    threadIdToUse = saveMessageResponse.threadId;
    return { coreMessages, threadIdToUse };
  }

  __primitive({
    messages,
    context,
    threadId,
    memoryConfig,
    resourceId,
    runId,
    toolsets,
  }: {
    toolsets?: ToolsetsInput;
    resourceId?: string;
    threadId?: string;
    memoryConfig?: MemoryConfig;
    context?: CoreMessage[];
    runId?: string;
    messages: CoreMessage[];
  }) {
    return {
      before: async () => {
        if (process.env.NODE_ENV !== 'test') {
          this.logger.debug(`[Agents:${this.name}] - Starting generation`, { runId });
        }

        const systemMessage: CoreMessage = {
          role: 'system',
          content: `${this.instructions}. Today's date is ${new Date().toISOString()}`,
        };

        let coreMessages = messages;
        let threadIdToUse = threadId;

        if (this.getMemory() && resourceId) {
          this.logger.debug(
            `[Agent:${this.name}] - Memory persistence enabled: store=${this.getMemory()?.constructor.name}, resourceId=${resourceId}`,
            {
              runId,
              resourceId,
              threadId: threadIdToUse,
              memoryStore: this.getMemory()?.constructor.name,
            },
          );
          const preExecuteResult = await this.preExecute({
            resourceId,
            runId,
            threadId: threadIdToUse,
            memoryConfig,
            messages,
          });

          coreMessages = preExecuteResult.coreMessages;
          threadIdToUse = preExecuteResult.threadIdToUse;
        }

        let convertedTools: Record<string, CoreTool> | undefined;

        if ((toolsets && Object.keys(toolsets || {}).length > 0) || (this.getMemory() && resourceId)) {
          const reasons = [];
          if (toolsets && Object.keys(toolsets || {}).length > 0) {
            reasons.push(`toolsets present (${Object.keys(toolsets || {}).length} tools)`);
          }
          if (this.getMemory() && resourceId) {
            reasons.push('memory and resourceId available');
          }

          this.logger.debug(`[Agent:${this.name}] - Enhancing tools: ${reasons.join(', ')}`, {
            runId,
            toolsets: toolsets ? Object.keys(toolsets) : undefined,
            hasMemory: !!this.getMemory(),
            hasResourceId: !!resourceId,
          });
          convertedTools = this.convertTools({
            toolsets,
            threadId: threadIdToUse,
            runId,
          });
        }

        const messageObjects = [systemMessage, ...(context || []), ...coreMessages];

        return { messageObjects, convertedTools, threadId: threadIdToUse as string };
      },
      after: async ({
        result,
        threadId,
        memoryConfig,
        outputText,
        runId,
      }: {
        runId: string;
        result: Record<string, any>;
        threadId: string;
        memoryConfig: MemoryConfig | undefined;
        outputText: string;
      }) => {
        const resToLog = {
          text: result?.text,
          object: result?.object,
          toolResults: result?.toolResults,
          toolCalls: result?.toolCalls,
          usage: result?.usage,
          steps: result?.steps?.map((s: any) => {
            return {
              stepType: s?.stepType,
              text: result?.text,
              object: result?.object,
              toolResults: result?.toolResults,
              toolCalls: result?.toolCalls,
              usage: result?.usage,
            };
          }),
        };
        this.logger.debug(`[Agent:${this.name}] - Post processing LLM response`, {
          runId,
          result: resToLog,
          threadId,
        });
        if (this.getMemory() && resourceId) {
          try {
            await this.saveResponse({
              result,
              threadId,
              resourceId,
              memoryConfig,
              runId,
            });
          } catch (e) {
            this.logger.error('Error saving response', {
              error: e,
              runId,
              result: resToLog,
              threadId,
            });
          }
        }

        if (Object.keys(this.evals || {}).length > 0) {
          const input = messages.map(message => message.content).join('\n');
          const runIdToUse = runId || crypto.randomUUID();
          for (const metric of Object.values(this.evals || {})) {
            executeHook(AvailableHooks.ON_GENERATION, {
              input,
              output: outputText,
              runId: runIdToUse,
              metric,
              agentName: this.name,
              instructions: this.instructions,
            });
          }
        }
      },
    };
  }

  async generate<Z extends ZodSchema | JSONSchema7 | undefined = undefined>(
    messages: string | string[] | CoreMessage[],
    {
      context,
      threadId: threadIdInFn,
      memoryOptions,
      resourceId,
      maxSteps = 5,
      onStepFinish,
      runId,
      toolsets,
      output = 'text',
      temperature,
      toolChoice = 'auto',
    }: AgentGenerateOptions<Z> = {},
  ): Promise<GenerateReturn<Z>> {
    let messagesToUse: CoreMessage[] = [];

    if (typeof messages === `string`) {
      messagesToUse = [
        {
          role: 'user',
          content: messages,
        },
      ];
    } else {
      messagesToUse = messages.map(message => {
        if (typeof message === `string`) {
          return {
            role: 'user',
            content: message,
          };
        }
        return message;
      });
    }

    const runIdToUse = runId || randomUUID();

    const { before, after } = this.__primitive({
      messages: messagesToUse,
      context,
      threadId: threadIdInFn,
      memoryConfig: memoryOptions,
      resourceId,
      runId: runIdToUse,
      toolsets,
    });

    const { threadId, messageObjects, convertedTools } = await before();

    if (output === 'text') {
      const result = await this.llm.__text({
        messages: messageObjects,
        tools: this.tools,
        convertedTools,
        onStepFinish,
        maxSteps,
        runId: runIdToUse,
        temperature,
        toolChoice,
      });

      const outputText = result.text;

      await after({ result, threadId, memoryConfig: memoryOptions, outputText, runId: runIdToUse });

      return result as unknown as GenerateReturn<Z>;
    }

    const result = await this.llm.__textObject({
      messages: messageObjects,
      tools: this.tools,
      structuredOutput: output,
      convertedTools,
      onStepFinish,
      maxSteps,
      runId: runIdToUse,
      temperature,
      toolChoice,
    });

    const outputText = JSON.stringify(result.object);

    await after({ result, threadId, memoryConfig: memoryOptions, outputText, runId: runIdToUse });

    return result as unknown as GenerateReturn<Z>;
  }

  async stream<Z extends ZodSchema | JSONSchema7 | undefined = undefined>(
    messages: string | string[] | CoreMessage[],
    {
      context,
      threadId: threadIdInFn,
      memoryOptions,
      resourceId,
      maxSteps = 5,
      onFinish,
      onStepFinish,
      runId,
      toolsets,
      output = 'text',
      temperature,
      toolChoice = 'auto',
    }: AgentStreamOptions<Z> = {},
  ): Promise<StreamReturn<Z>> {
    const runIdToUse = runId || randomUUID();

    let messagesToUse: CoreMessage[] = [];

    if (typeof messages === `string`) {
      messagesToUse = [
        {
          role: 'user',
          content: messages,
        },
      ];
    } else {
      messagesToUse = messages.map(message => {
        if (typeof message === `string`) {
          return {
            role: 'user',
            content: message,
          };
        }
        return message;
      });
    }

    const { before, after } = this.__primitive({
      messages: messagesToUse,
      context,
      threadId: threadIdInFn,
      memoryConfig: memoryOptions,
      resourceId,
      runId: runIdToUse,
      toolsets,
    });

    const { threadId, messageObjects, convertedTools } = await before();

    if (output === 'text') {
      this.logger.debug(`Starting agent ${this.name} llm stream call`, {
        runId,
      });
      return this.llm.__stream({
        messages: messageObjects,
        temperature,
        tools: this.tools,
        convertedTools,
        onStepFinish,
        onFinish: async (result: string) => {
          try {
            const res = JSON.parse(result) || {};
            const outputText = res.text;
            await after({ result: res, threadId, memoryConfig: memoryOptions, outputText, runId: runIdToUse });
          } catch (e) {
            this.logger.error('Error saving memory on finish', {
              error: e,
              runId,
            });
          }
          onFinish?.(result);
        },
        maxSteps,
        runId,
        toolChoice,
      }) as unknown as StreamReturn<Z>;
    }

    this.logger.debug(`Starting agent ${this.name} llm streamObject call`, {
      runId,
    });
    return this.llm.__streamObject({
      messages: messageObjects,
      tools: this.tools,
      temperature,
      structuredOutput: output,
      convertedTools,
      onStepFinish,
      onFinish: async (result: string) => {
        try {
          const res = JSON.parse(result) || {};
          const outputText = JSON.stringify(res.object);
          await after({ result: res, threadId, memoryConfig: memoryOptions, outputText, runId: runIdToUse });
        } catch (e) {
          this.logger.error('Error saving memory on finish', {
            error: e,
            runId,
          });
        }
        onFinish?.(result);
      },
      maxSteps,
      runId,
      toolChoice,
    }) as unknown as StreamReturn<Z>;
  }
}
