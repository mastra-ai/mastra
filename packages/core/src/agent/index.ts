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
import { z } from 'zod';

import { Integration } from '../integration';
import { LLM } from '../llm';
import { ModelConfig, StructuredOutput } from '../llm/types';
import { BaseLogMessage, createLogger, Logger, LogLevel, RegisteredLogger } from '../logger';
import { MastraMemory, ThreadType } from '../memory';
import { Run } from '../run/types';
import { InstrumentClass, Telemetry } from '../telemetry';
import { AllTools, CoreTool, ToolApi } from '../tools/types';

@InstrumentClass({
  prefix: 'agent',
  excludeMethods: ['__setTools', '__setLogger', '__setTelemetry', '#log'],
})
export class Agent<
  TTools,
  TIntegrations extends Integration[] | undefined = undefined,
  TKeys extends keyof AllTools<TTools, TIntegrations> = keyof AllTools<TTools, TIntegrations>,
> {
  public name: string;
  private memory?: MastraMemory;
  readonly llm: LLM<TTools, TIntegrations, TKeys>;
  readonly instructions: string;
  readonly model: ModelConfig;
  readonly enabledTools: Partial<Record<TKeys, boolean>>;
  #tools: Record<TKeys, ToolApi>;
  #logger: Logger;
  #telemetry?: Telemetry;

  constructor(config: {
    name: string;
    instructions: string;
    model: ModelConfig;
    enabledTools?: Partial<Record<TKeys, boolean>>;
  }) {
    this.name = config.name;
    this.instructions = config.instructions;

    this.llm = new LLM<TTools, TIntegrations, TKeys>({ model: config.model });

    this.model = config.model;
    this.enabledTools = config.enabledTools || {};
    this.#logger = createLogger({ type: 'CONSOLE' });
    this.#logger.info(`Agent ${this.name} initialized with model ${this.model.provider}`);
    this.#tools = {} as Record<TKeys, ToolApi>;
  }

  /**
   * Set the concrete tools for the agent
   * @param tools
   */
  __setTools(tools: Record<TKeys, ToolApi>) {
    this.llm.__setTools(tools);
    this.#tools = tools;
    this.#log(LogLevel.DEBUG, `Tools set for agent ${this.name}`);
  }

  /**
   * Set the logger for the agent
   * @param logger
   */
  __setLogger(logger: Logger) {
    this.#logger = logger;
    this.llm.__setLogger(logger);
    this.#log(LogLevel.DEBUG, `Logger updated for agent ${this.name}`);
  }

  __setMemory(memory: MastraMemory) {
    this.memory = memory;
    this.#log(LogLevel.DEBUG, `Memory set for agent ${this.name}`);
  }

  /**
   * Set the telemetry for the agent
   * @param telemetry
   */
  __setTelemetry(telemetry: Telemetry) {
    this.#telemetry = telemetry;
    this.llm.__setTelemetry(this.#telemetry);
    this.#log(LogLevel.DEBUG, `Telemetry updated for agent ${this.name}`);
  }

  /**
   * Internal logging helper that formats and sends logs to the configured logger
   * @param level - Severity level of the log
   * @param message - Main log message
   * @param runId - Optional runId for the log
   */
  #log(level: LogLevel, message: string, runId?: string) {
    if (!this.#logger) return;

    const logMessage: BaseLogMessage = {
      type: RegisteredLogger.AGENT,
      message,
      destinationPath: 'AGENT',
      runId,
    };

    const logMethod = level.toLowerCase() as keyof Logger<BaseLogMessage>;

    this.#logger[logMethod]?.(logMessage);
  }

  async generateTitleFromUserMessage({ message }: { message: CoreUserMessage }) {
    const { text: title } = await this.llm.__text({
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
    });

    return title;
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
    if (this.memory) {
      console.log({ threadId, resourceid }, 'SAVING');
      let thread: ThreadType | null;
      if (!threadId) {
        const title = await this.genTitle(userMessage);

        thread = await this.memory.createThread({
          threadId,
          resourceid,
          title,
        });
      } else {
        thread = await this.memory.getThreadById({ threadId });
        if (!thread) {
          const title = await this.genTitle(userMessage);
          thread = await this.memory.createThread({
            threadId,
            resourceid,
            title,
          });
        }
      }

      console.log({ thread });

      const newMessages = userMessage ? [userMessage] : userMessages;

      if (thread) {
        const messages = newMessages.map(u => {
          return {
            id: this.memory?.generateId()!,
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
            content: `Analyze this message to determine if the user is referring to a previous conversation with the LLM. Specifically, identify if the user wants to reference specific information from that chat or if they want the LLM to use the previous chat messages as context for the current conversation. Extract any date ranges mentioned in the user message that could help identify the previous chat. Return dates in ISO format. If no specific dates are mentioned but time periods are (like "last week" or "past month"), calculate the appropriate date range. For the end date, return the date 1 day after the end of the time period. Today's date is ${new Date().toISOString()}`,
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
        console.log('context object===', JSON.stringify(context.object, null, 2));

        let memoryMessages: CoreMessage[];

        if (context.object?.usesContext) {
          const contextWindowMessages = await this.memory.getContextWindow({
            threadId: thread.id,
            startDate: context.object?.startDate ? new Date(context.object?.startDate) : undefined,
            endDate: context.object?.endDate ? new Date(context.object?.endDate) : undefined,
          });

          memoryMessages = contextWindowMessages?.map(
            ({ role, content }) =>
              ({
                role,
                content,
              }) as CoreMessage,
          );
        } else {
          const contextWindowMessages = await this.memory.getContextWindow({
            threadId: thread.id,
          });

          memoryMessages = contextWindowMessages?.map(
            ({ role, content }) =>
              ({
                role,
                content,
              }) as CoreMessage,
          );
        }
        await this.memory.saveMessages({ messages });

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

  async saveMemoryOnFinish({ result, threadId }: { result: string; threadId: string }) {
    const { response } = JSON.parse(result) || {};
    try {
      if (response.messages) {
        const ms = Array.isArray(response.messages) ? response.messages : [response.messages];

        const responseMessagesWithoutIncompleteToolCalls = this.sanitizeResponseMessages(ms);

        if (this.memory) {
          console.log('saving memory on finish====', { threadId });

          await this.memory.saveMessages({
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
      console.error('Failed to save chat', err);
    }
  }

  sanitizeResponseMessages(
    messages: Array<CoreToolMessage | CoreAssistantMessage>,
  ): Array<CoreToolMessage | CoreAssistantMessage> {
    let toolResultIds: Array<string> = [];

    for (const message of messages) {
      console.log(message);
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
    enabledTools,
    threadId,
    runId,
  }: {
    enabledTools?: Partial<Record<TKeys, boolean>>;
    threadId: string;
    runId?: string;
  }): Record<TKeys, CoreTool> {
    const converted = Object.entries(enabledTools || {}).reduce(
      (memo, value) => {
        const k = value[0] as TKeys;
        const enabled = value[1] as boolean;
        const tool = this.#tools[k];

        if (enabled && tool) {
          memo[k] = {
            description: tool.description,
            parameters: z.object({
              data: tool.schema,
            }),
            execute: async args => {
              if (tool.enableCache) {
                const cachedResult = await this.memory?.getToolResult({
                  threadId,
                  toolArgs: args,
                  toolName: k as string,
                });
                if (cachedResult) {
                  this.#logger.debug(
                    `Cached Result ${k as string} runId: ${runId}`,
                    JSON.stringify(cachedResult, null, 2),
                  );
                  return cachedResult;
                }
              }
              this.#logger.debug(`Cache not found or not enabled, executing tool runId: ${runId}`, runId);
              return tool.executor(args);
            },
          };
        }
        return memo;
      },
      {} as Record<TKeys, CoreTool>,
    );

    this.#log(LogLevel.DEBUG, `Converted tools for Agent ${this.name}`, runId);
    return converted;
  }

  async text({
    messages,
    onStepFinish,
    maxSteps = 5,
    threadId,
    resourceid,
    runId,
  }: {
    resourceid?: string;
    threadId?: string;
    messages: UserContent[];
    onStepFinish?: (step: string) => void;
    maxSteps?: number;
  } & Run) {
    this.#log(LogLevel.INFO, `Starting text generation for agent ${this.name}`, runId);

    const systemMessage: CoreMessage = {
      role: 'system',
      content: `${this.instructions}. Today's date is ${new Date().toISOString()}`,
    };

    const userMessages: CoreMessage[] = messages.map(content => ({
      role: 'user',
      content: content,
    }));

    let coreMessages = userMessages;

    let convertedTools: Record<TKeys, CoreTool> | undefined;

    let threadIdToUse = threadId;

    if (this.memory && resourceid) {
      this.#log(LogLevel.INFO, `Saving user messages in memory for agent ${this.name}`, runId);
      const saveMessageResponse = await this.saveMemory({
        threadId: threadIdToUse,
        resourceid,
        userMessages,
      });

      coreMessages = saveMessageResponse.messages;
      threadIdToUse = saveMessageResponse.threadId;

      convertedTools = this.convertTools({
        enabledTools: this.enabledTools,
        threadId: threadIdToUse,
        runId,
      });

      console.log('convertedTools====', JSON.stringify(convertedTools, null, 2));
    }

    const messageObjects = [systemMessage, ...coreMessages];

    return this.llm.__text({
      messages: messageObjects,
      enabledTools: this.enabledTools,
      convertedTools,
      onStepFinish,
      maxSteps,
      runId,
    });
  }

  async textObject({
    messages,
    structuredOutput,
    onStepFinish,
    maxSteps = 5,
    threadId,
    resourceid,
    runId,
  }: {
    resourceid?: string;
    threadId?: string;
    messages: UserContent[];
    structuredOutput: StructuredOutput;
    onStepFinish?: (step: string) => void;
    maxSteps?: number;
  } & Run) {
    this.#log(LogLevel.INFO, `Starting text generation for agent ${this.name}`, runId);

    const systemMessage: CoreMessage = {
      role: 'system',
      content: `${this.instructions}. Today's date is ${new Date().toISOString()}`,
    };

    const userMessages: CoreMessage[] = messages.map(content => ({
      role: 'user',
      content: content,
    }));

    let coreMessages = userMessages;

    let convertedTools: Record<TKeys, CoreTool> | undefined;

    let threadIdToUse = threadId;

    if (this.memory && resourceid) {
      this.#log(LogLevel.INFO, `Saving user messages in memory for agent ${this.name}`, runId);
      const saveMessageResponse = await this.saveMemory({
        threadId: threadIdToUse,
        resourceid,
        userMessages,
      });

      coreMessages = saveMessageResponse.messages;
      threadIdToUse = saveMessageResponse.threadId;

      convertedTools = this.convertTools({
        enabledTools: this.enabledTools,
        threadId: threadIdToUse,
        runId,
      });

      console.log('convertedTools====', JSON.stringify(convertedTools, null, 2));
    }

    const messageObjects = [systemMessage, ...coreMessages];

    return this.llm.__textObject({
      messages: messageObjects,
      structuredOutput,
      enabledTools: this.enabledTools,
      convertedTools,
      onStepFinish,
      maxSteps,
      runId,
    });
  }

  async stream({
    messages,
    onStepFinish,
    onFinish,
    maxSteps = 5,
    threadId,
    resourceid,
    runId,
  }: {
    resourceid?: string;
    threadId?: string;
    messages: UserContent[];
    onStepFinish?: (step: string) => void;
    onFinish?: (result: string) => Promise<void> | void;
    maxSteps?: number;
  } & Run) {
    this.#log(LogLevel.INFO, `Starting stream generation for agent ${this.name}`, runId);

    const systemMessage: CoreMessage = {
      role: 'system',
      content: `${this.instructions}. Today's date is ${new Date().toISOString()}`,
    };

    const userMessages: CoreMessage[] = messages.map(content => ({
      role: 'user',
      content: content,
    }));

    let coreMessages = userMessages;

    let convertedTools: Record<TKeys, CoreTool> | undefined;

    let threadIdToUse = threadId;

    if (this.memory && resourceid) {
      this.#log(LogLevel.INFO, `Saving user messages in memory for agent ${this.name}`, runId);
      const saveMessageResponse = await this.saveMemory({
        threadId: threadIdToUse,
        resourceid,
        userMessages,
      });

      coreMessages = saveMessageResponse.messages;
      threadIdToUse = saveMessageResponse.threadId;

      convertedTools = this.convertTools({
        enabledTools: this.enabledTools,
        threadId: threadIdToUse,
        runId,
      });
    }

    const messageObjects = [systemMessage, ...coreMessages];

    console.log('start streaming in agent');

    return this.llm.__stream({
      messages: messageObjects,
      enabledTools: this.enabledTools,
      convertedTools,
      onStepFinish,
      onFinish: async result => {
        console.log('onFinish====', result);
        if (this.memory && resourceid) {
          this.#log(LogLevel.INFO, `Saving assistant message in memory for agent ${this.name}`, runId);
          await this.saveMemoryOnFinish({
            result,
            threadId: threadIdToUse!,
          });
        }
        onFinish?.(result);
      },
      maxSteps,
      runId,
    });
  }

  async streamObject({
    messages,
    structuredOutput,
    onStepFinish,
    onFinish,
    maxSteps = 5,
    threadId,
    resourceid,
    runId,
  }: {
    resourceid?: string;
    threadId?: string;
    messages: UserContent[];
    structuredOutput: StructuredOutput;
    onStepFinish?: (step: string) => void;
    onFinish?: (result: string) => Promise<void> | void;
    maxSteps?: number;
  } & Run) {
    this.#log(LogLevel.INFO, `Starting stream generation for agent ${this.name}`, runId);

    const systemMessage: CoreMessage = {
      role: 'system',
      content: `${this.instructions}. Today's date is ${new Date().toISOString()}`,
    };

    const userMessages: CoreMessage[] = messages.map(content => ({
      role: 'user',
      content: content,
    }));

    let coreMessages = userMessages;

    let convertedTools: Record<TKeys, CoreTool> | undefined;

    let threadIdToUse = threadId;

    if (this.memory && resourceid) {
      this.#log(LogLevel.INFO, `Saving user messages in memory for agent ${this.name}`, runId);
      const saveMessageResponse = await this.saveMemory({
        threadId: threadIdToUse,
        resourceid,
        userMessages,
      });

      coreMessages = saveMessageResponse.messages;
      threadIdToUse = saveMessageResponse.threadId;

      convertedTools = this.convertTools({
        enabledTools: this.enabledTools,
        threadId: threadIdToUse,
        runId,
      });

      console.log('convertedTools====', JSON.stringify(convertedTools, null, 2));
    }

    const messageObjects = [systemMessage, ...coreMessages];

    return this.llm.__streamObject({
      messages: messageObjects,
      structuredOutput,
      enabledTools: this.enabledTools,
      convertedTools,
      onStepFinish,
      onFinish: async result => {
        if (this.memory && resourceid) {
          this.#log(LogLevel.INFO, `Saving assistant message in memory for agent ${this.name}`, runId);
          await this.saveMemoryOnFinish({
            result,
            threadId: threadIdToUse!,
          });
        }
        onFinish?.(result);
      },
      maxSteps,
      runId,
    });
  }
}
