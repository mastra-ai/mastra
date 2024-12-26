import {
  AssistantContent,
  CoreAssistantMessage,
  CoreMessage,
  CoreToolMessage,
  CoreUserMessage,
  TextPart,
  ToolCallPart,
  UserContent,
} from 'ai';
import { randomUUID } from 'crypto';
import { ZodSchema } from 'zod';

import { MastraPrimitives } from '../action';
import { MastraBase } from '../base';
import { LLM } from '../llm';
import { GenerateReturn, ModelConfig } from '../llm/types';
import { LogLevel, RegisteredLogger } from '../logger';
import { ThreadType } from '../memory';
import { InstrumentClass } from '../telemetry';
import { CoreTool, ToolAction } from '../tools/types';

import { ToolsetsInput } from './types';

@InstrumentClass({
  prefix: 'agent',
  excludeMethods: ['__setTools', '__setLogger', '__setTelemetry', 'log'],
})
export class Agent<
  TTools extends Record<string, ToolAction<any, any, any, any>> = Record<string, ToolAction<any, any, any, any>>,
> extends MastraBase {
  public name: string;
  readonly llm: LLM;
  readonly instructions: string;
  readonly model: ModelConfig;
  #mastra?: MastraPrimitives;
  tools: TTools;

  constructor(config: {
    name: string;
    instructions: string;
    model: ModelConfig;
    tools?: TTools;
    mastra?: MastraPrimitives;
  }) {
    super({ component: RegisteredLogger.AGENT });

    this.name = config.name;
    this.instructions = config.instructions;

    this.llm = new LLM({ model: config.model });

    this.model = config.model;

    this.log(LogLevel.DEBUG, `Agent ${this.name} initialized with model ${this.model.provider}`, { runId: this.name });

    this.tools = {} as TTools;

    if (config.tools) {
      this.tools = config.tools;
    }

    if (config.mastra) {
      this.#mastra = config.mastra;
    }
  }

  __registerPrimitives(p: MastraPrimitives) {
    if (p.telemetry) {
      this.__setTelemetry(p.telemetry);
    }

    if (p.logger) {
      this.__setLogger(p.logger);
    }

    this.#mastra = p;
  }

  /**
   * Set the concrete tools for the agent
   * @param tools
   */
  __setTools(tools: TTools) {
    this.tools = tools;
    this.log(LogLevel.DEBUG, `Tools set for agent ${this.name}`, { runId: this.name });
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
      structuredOutput: {
        title: {
          type: 'string',
        },
      },
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
    resourceid,
    userMessages,
  }: {
    resourceid: string;
    threadId?: string;
    userMessages: CoreMessage[];
    time?: Date;
    keyword?: string;
  }) {
    const userMessage = this.getMostRecentUserMessage(userMessages);
    if (this.#mastra?.memory) {
      let thread: ThreadType | null;
      if (!threadId) {
        this.log(LogLevel.DEBUG, `No threadId, creating new thread for agent ${this.name}`, {
          runId: this.name,
        });
        const title = await this.genTitle(userMessage);

        thread = await this.#mastra.memory.createThread({
          threadId,
          resourceid,
          title,
        });
      } else {
        thread = await this.#mastra.memory.getThreadById({ threadId });
        if (!thread) {
          this.log(LogLevel.DEBUG, `Thread not found, creating new thread for agent ${this.name}`, {
            runId: this.name,
          });
          const title = await this.genTitle(userMessage);
          thread = await this.#mastra.memory.createThread({
            threadId,
            resourceid,
            title,
          });
        }
      }

      const newMessages = userMessage ? [userMessage] : userMessages;

      if (thread) {
        const messages = newMessages.map(u => {
          return {
            id: this.#mastra?.memory?.generateId()!,
            createdAt: new Date(),
            threadId: thread.id,
            ...u,
            content: u.content as UserContent | AssistantContent,
            role: u.role as 'user' | 'assistant',
            type: 'text' as 'text' | 'tool-call' | 'tool-result',
          };
        });

        const contextCallMessages: CoreMessage[] = [
          {
            role: 'system',
            content: `\n
            Analyze this message to determine if the user is referring to a previous conversation with the LLM.
            Specifically, identify if the user wants to reference specific information from that chat or if they want the LLM to use the previous chat messages as context for the current conversation.
            Extract any date ranges mentioned in the user message that could help identify the previous chat.
            Return dates in ISO format.
            If no specific dates are mentioned but time periods are (like "last week" or "past month"), calculate the appropriate date range.
            For the end date, return the date 1 day after the end of the time period.
            Today's date is ${new Date().toISOString()}`,
          },
          ...newMessages,
        ];

        const context = await this.llm.__textObject({
          messages: contextCallMessages,
          structuredOutput: {
            usesContext: {
              type: 'boolean',
            },
            startDate: {
              type: 'date',
            },
            endDate: {
              type: 'date',
            },
          },
        });

        // this.logger.debug('Text Object result', JSON.stringify(context.object, null, 2));

        this.log(LogLevel.DEBUG, 'Text Object result', {
          contextObject: JSON.stringify(context.object, null, 2),
          runId: this.name,
        });

        let memoryMessages: CoreMessage[];

        if (context.object?.usesContext) {
          memoryMessages = await this.#mastra.memory.getContextWindow({
            threadId: thread.id,
            format: 'core_message',
            startDate: context.object?.startDate ? new Date(context.object?.startDate) : undefined,
            endDate: context.object?.endDate ? new Date(context.object?.endDate) : undefined,
          });
        } else {
          memoryMessages = await this.#mastra.memory.getContextWindow({
            threadId: thread.id,
            format: 'core_message',
          });
        }

        await this.#mastra.memory.saveMessages({ messages });

        this.log(LogLevel.DEBUG, 'Saved messages to memory', {
          threadId: thread.id,
          runId: this.name,
        });

        return {
          threadId: thread.id,
          messages: [...memoryMessages, ...newMessages],
        };
      }

      return {
        threadId: (thread as ThreadType)?.id || threadId || '',
        messages: userMessages,
      };
    }

    return { threadId: threadId || '', messages: userMessages };
  }

  async saveResponse({ result, threadId }: { result: Record<string, any>; threadId: string }) {
    const { response } = result;
    try {
      if (response.messages) {
        const ms = Array.isArray(response.messages) ? response.messages : [response.messages];

        const responseMessagesWithoutIncompleteToolCalls = this.sanitizeResponseMessages(ms);

        if (this.#mastra?.memory) {
          this.log(LogLevel.DEBUG, 'Saving response to memory', { threadId, runId: this.name });

          await this.#mastra.memory.saveMessages({
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
      this.log(LogLevel.ERROR, 'Failed to save assistant response', {
        error: err,
        runId: this.name,
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
    threadId,
    runId,
  }: {
    toolsets?: ToolsetsInput;
    threadId?: string;
    runId?: string;
  }): Record<string, CoreTool> {
    this.log(LogLevel.DEBUG, `Starting tool conversion for Agent ${this.name}`, { runId });
    const converted = Object.entries(this.tools || {}).reduce(
      (memo, value) => {
        const k = value[0];
        const tool = this.tools[k];

        if (tool) {
          memo[k] = {
            description: tool.description,
            parameters: tool.inputSchema,
            execute: async args => {
              if (threadId && tool.enableCache && this.#mastra?.memory) {
                const cachedResult = await this.#mastra.memory.getToolResult({
                  threadId,
                  toolArgs: args,
                  toolName: k as string,
                });
                if (cachedResult) {
                  this.log(LogLevel.DEBUG, `Cached Result ${k as string} runId: ${runId}`, {
                    cachedResult: JSON.stringify(cachedResult, null, 2),
                    runId,
                  });
                  return cachedResult;
                }
              }
              this.log(LogLevel.DEBUG, `Cache not found or not enabled, executing tool runId: ${runId}`, {
                runId,
              });
              return tool.execute({
                context: args,
                mastra: this.#mastra,
              });
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

    this.log(LogLevel.DEBUG, `Converted tools for Agent ${this.name}`, { runId });

    const toolsFromToolsets = Object.values(toolsets || {});

    if (toolsFromToolsets.length > 0) {
      this.log(LogLevel.DEBUG, `Adding tools from toolsets ${Object.keys(toolsets || {}).join(', ')}`, { runId });
      toolsFromToolsets.forEach(toolset => {
        Object.entries(toolset).forEach(([toolName, tool]) => {
          const toolObj = tool;
          toolsFromToolsetsConverted[toolName] = {
            description: toolObj.description || '',
            parameters: toolObj.inputSchema,
            execute: async args => {
              if (threadId && toolObj.enableCache && this.#mastra?.memory) {
                const cachedResult = await this.#mastra.memory.getToolResult({
                  threadId,
                  toolArgs: args,
                  toolName,
                });
                if (cachedResult) {
                  this.log(LogLevel.DEBUG, `Cached Result ${toolName as string} runId: ${runId}`, {
                    cachedResult: JSON.stringify(cachedResult, null, 2),
                    runId,
                  });
                  return cachedResult;
                }
              }
              this.log(LogLevel.DEBUG, `Cache not found or not enabled, executing tool runId: ${runId}`, {
                runId,
              });
              return toolObj.execute!({
                context: args,
              });
            },
          };
        });
      });
    }

    return toolsFromToolsetsConverted;
  }

  async preExecute({
    resourceid,
    runId,
    threadId,
    messages,
  }: {
    runId?: string;
    threadId?: string;
    messages: CoreMessage[];
    resourceid: string;
  }) {
    let coreMessages: CoreMessage[] = [];
    let threadIdToUse = threadId;
    this.log(LogLevel.INFO, `Saving user messages in memory for agent ${this.name}`, { runId });
    const saveMessageResponse = await this.saveMemory({
      threadId,
      resourceid,
      userMessages: messages,
    });

    coreMessages = saveMessageResponse.messages;
    threadIdToUse = saveMessageResponse.threadId;
    return { coreMessages, threadIdToUse };
  }

  __primitive({
    messages,
    context,
    threadId,
    resourceid,
    runId,
    toolsets,
  }: {
    toolsets?: ToolsetsInput;
    resourceid?: string;
    threadId?: string;
    context?: CoreMessage[];
    runId?: string;
    messages: UserContent[];
  }) {
    return {
      before: async () => {
        this.log(LogLevel.INFO, `Starting generation for agent ${this.name}`, { runId });

        const systemMessage: CoreMessage = {
          role: 'system',
          content: `${this.instructions}. Today's date is ${new Date().toISOString()}`,
        };

        const userMessages: CoreMessage[] = messages.map(content => ({
          role: 'user',
          content: content,
        }));

        let coreMessages = userMessages;

        let convertedTools: Record<string, CoreTool> | undefined;

        let threadIdToUse = threadId;

        if (this.#mastra?.memory && resourceid) {
          const preExecuteResult = await this.preExecute({
            resourceid,
            runId,
            threadId: threadIdToUse,
            messages: userMessages,
          });

          coreMessages = preExecuteResult.coreMessages;
          threadIdToUse = preExecuteResult.threadIdToUse;
        } else {
          this.log(LogLevel.DEBUG, `No memory or resourceid, skipping save to memory for agent ${this.name}`, {
            runId: this.name,
          });
        }

        if (
          (toolsets && Object.keys(toolsets || {}).length > 0) ||
          (this.#mastra?.memory && resourceid) ||
          this.#mastra?.engine ||
          this.#mastra?.syncs
        ) {
          convertedTools = this.convertTools({
            toolsets,
            threadId: threadIdToUse,
            runId,
          });
        } else {
          this.log(LogLevel.DEBUG, `Skipping tool conversion for agent ${this.name}`, {
            runId: this.name,
          });
        }

        const messageObjects = [systemMessage, ...(context || []), ...coreMessages];

        return { messageObjects, convertedTools, threadId: threadIdToUse as string };
      },
      after: async ({ result, threadId }: { result: Record<string, any>; threadId: string }) => {
        this.log(LogLevel.DEBUG, `After LLM call for agent ${this.name}`, {
          runId: this.name,
        });
        if (this.#mastra?.memory && resourceid) {
          try {
            this.log(LogLevel.INFO, `Saving assistant message in memory for agent ${this.name}`, { runId });
            await this.saveResponse({
              result,
              threadId,
            });
          } catch (e) {
            this.log(LogLevel.ERROR, 'Error saving response', {
              error: e,
              runId,
            });
          }
        } else {
          this.log(
            LogLevel.DEBUG,
            `No memory or resourceid, skipping save assistant response to memory for agent ${this.name}`,
            {
              runId: this.name,
            },
          );
        }
      },
    };
  }

  async generate<S extends boolean = false, Z extends ZodSchema | undefined = undefined>(
    messages: string | string[] | CoreMessage[],
    {
      schema,
      stream,
      context,
      threadId: threadIdInFn,
      resourceid,
      maxSteps = 5,
      onFinish,
      onStepFinish,
      runId,
      toolsets,
    }: {
      toolsets?: ToolsetsInput;
      resourceid?: string;
      context?: CoreMessage[];
      threadId?: string;
      runId?: string;
      stream?: S;
      schema?: Z;
      onFinish?: (result: string) => Promise<void> | void;
      onStepFinish?: (step: string) => void;
      maxSteps?: number;
    } = {},
  ): Promise<GenerateReturn<S, Z>> {
    let messagesToUse: UserContent[] = [];

    if (Array.isArray(messages)) {
      messagesToUse = messages.map(content => {
        if (typeof content === 'string') {
          return content;
        }
        return content.content as string;
      });
    } else {
      messagesToUse = [messages];
    }

    const { before, after } = this.__primitive({
      messages: messagesToUse,
      context,
      threadId: threadIdInFn,
      resourceid,
      runId: runId || this.name,
      toolsets,
    });

    const { threadId, messageObjects, convertedTools } = await before();

    if (stream && schema) {
      this.log(LogLevel.DEBUG, `Starting agent ${this.name} llm streamObject call`, {
        runId: this.name,
      });
      return this.llm.__streamObject({
        messages: messageObjects,
        tools: this.tools,
        structuredOutput: schema,
        convertedTools,
        onStepFinish,
        onFinish: async result => {
          try {
            const res = JSON.parse(result) || {};
            await after({ result: res, threadId });
          } catch (e) {
            this.log(LogLevel.ERROR, 'Error saving memory on finish', {
              error: e,
              runId: this.name,
            });
          }
          onFinish?.(result);
        },
        maxSteps,
        runId,
      }) as unknown as GenerateReturn<S, Z>;
    }

    if (stream) {
      this.log(LogLevel.DEBUG, `Starting agent ${this.name} llm stream call`, {
        runId: this.name,
      });
      return this.llm.__stream({
        messages: messageObjects,
        tools: this.tools,
        convertedTools,
        onStepFinish,
        onFinish: async result => {
          try {
            const res = JSON.parse(result) || {};
            await after({ result: res, threadId });
          } catch (e) {
            this.log(LogLevel.ERROR, 'Error saving memory on finish', {
              error: e,
              runId: this.name,
            });
          }
          onFinish?.(result);
        },
        maxSteps,
        runId,
      }) as unknown as GenerateReturn<S, Z>;
    }

    if (schema) {
      this.log(LogLevel.DEBUG, `Starting agent ${this.name} llm textObject call`, {
        runId: this.name,
      });
      const result = await this.llm.__textObject({
        messages: messageObjects,
        tools: this.tools,
        structuredOutput: schema,
        convertedTools,
        onStepFinish,
        maxSteps,
        runId,
      });

      await after({ result, threadId });

      return result as unknown as GenerateReturn<S, Z>;
    }

    this.log(LogLevel.DEBUG, `Starting agent ${this.name} llm text call`, {
      runId: this.name,
    });

    const result = await this.llm.__text({
      messages: messageObjects,
      tools: this.tools,
      convertedTools,
      onStepFinish,
      maxSteps,
      runId,
    });

    await after({ result, threadId });

    return result as unknown as GenerateReturn<S, Z>;
  }
}
