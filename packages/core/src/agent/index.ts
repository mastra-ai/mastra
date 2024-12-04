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
import { Integration } from '../integration';
import { createLogger, Logger } from '../logger';
import { AllTools, ToolApi } from '../tools/types';
import { LLM } from '../llm';
import { ModelConfig, StructuredOutput } from '../llm/types';
import { MastraMemory, ThreadType } from '../memory';
import { randomUUID } from 'crypto';

export class Agent<
  TTools,
  TIntegrations extends Integration[] | undefined = undefined,
  TKeys extends keyof AllTools<TTools, TIntegrations> = keyof AllTools<
    TTools,
    TIntegrations
  >,
> {
  public name: string;
  private memory?: MastraMemory;
  readonly llm: LLM<TTools, TIntegrations, TKeys>;
  readonly instructions: string;
  readonly model: ModelConfig;
  readonly enabledTools: Partial<Record<TKeys, boolean>>;
  logger: Logger;

  constructor(config: {
    name: string;
    instructions: string;
    model: ModelConfig;
    enabledTools?: Partial<Record<TKeys, boolean>>;
  }) {
    this.name = config.name;
    this.instructions = config.instructions;

    this.llm = new LLM<TTools, TIntegrations, TKeys>();

    this.model = config.model;
    this.enabledTools = config.enabledTools || {};
    this.logger = createLogger({ type: 'CONSOLE' });
    this.logger.info(
      `Agent ${this.name} initialized with model ${this.model.provider}`
    );
  }

  /**
   * Set the concrete tools for the agent
   * @param tools
   */
  __setTools(tools: Record<TKeys, ToolApi>) {
    this.llm.__setTools(tools);
    this.logger.debug(`Tools set for agent ${this.name}`, tools);
  }

  /**
   * Set the logger for the agent
   * @param logger
   */
  __setLogger(logger: Logger) {
    this.logger = logger;
    this.logger.debug(`Logger updated for agent ${this.name}`);
  }

  __setMemory(memory: MastraMemory) {
    this.memory = memory;
  }

  async generateTitleFromUserMessage({
    message,
  }: {
    message: CoreUserMessage;
  }) {
    const { text: title } = await this.llm.text({
      model: this.model,
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
    const userMessages = messages.filter((message) => message.role === 'user');
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
        const messages = newMessages.map((u) => {
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
            content:
              'Analyze this message to determine if the user is referring to a previous conversation with the LLM. Specifically, identify if the user wants to reference specific information from that chat or if they want the LLM to use the previous chat messages as context for the current conversation. Extract any relevant keywords or dates mentioned in the user message that could help identify the previous chat.',
          },
          ...newMessages,
        ];
        const context = await this.llm.textObject({
          model: this.model,
          messages: contextCallMessages,
          enabledTools: { todayTool: true } as any,
          structuredOutput: {
            usesContext: {
              type: 'boolean',
            },
            keyword: {
              type: 'string',
            },
            specifiedDay: {
              type: 'date',
            },
          },
        });
        console.log(
          'context object===',
          JSON.stringify(context.object, null, 2)
        );

        let memoryMessages: CoreMessage[];

        if (context.object?.usesContext) {
          const contextWindowMessages = await this.memory.getContextWindow({
            threadId: thread.id,
            time: context.object?.specifiedDay
              ? new Date(context.object?.specifiedDay)
              : undefined,
            keyword: context.object?.keyword,
          });

          memoryMessages = contextWindowMessages?.map(
            ({ role, content }) =>
              ({
                role,
                content,
              }) as CoreMessage
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
              }) as CoreMessage
          );
        }
        await this.memory.saveMessages({ messages });

        // const memoryMessages = await this.memory.getContextWindow({
        //   threadId: thread.id,
        //   time,
        //   keyword,
        // });

        return [...memoryMessages, ...newMessages];
      }

      return userMessages;
    }

    return userMessages;
  }

  async saveMemoryOnFinish({
    result,
    threadId,
    resourceid,
    userMessages,
  }: {
    result: string;
    resourceid: string;
    threadId?: string;
    userMessages: CoreMessage[];
  }) {
    const { response } = JSON.parse(result) || {};
    try {
      if (response.messages) {
        const ms = Array.isArray(response.messages)
          ? response.messages
          : [response.messages];

        const responseMessagesWithoutIncompleteToolCalls =
          this.sanitizeResponseMessages(ms);

        const userMessage = this.getMostRecentUserMessage(userMessages);

        if (this.memory) {
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
          this.memory.saveMessages({
            messages: responseMessagesWithoutIncompleteToolCalls.map(
              (message: CoreMessage | CoreAssistantMessage) => {
                const messageId = randomUUID();
                let toolCallIds: string[] | undefined;
                let toolCallArgs: Record<string, unknown>[] | undefined;
                let type: 'text' | 'tool-call' | 'tool-result' = 'text';
                if (message.role === 'tool') {
                  toolCallIds = (message as CoreToolMessage).content.map(
                    (content) => content.toolCallId
                  );
                  type = 'tool-result';
                }
                if (message.role === 'assistant') {
                  const assistantContent = (message as CoreAssistantMessage)
                    .content as Array<TextPart | ToolCallPart>;
                  const assistantToolCalls = assistantContent
                    .map((content) => {
                      if (content.type === 'tool-call') {
                        return {
                          toolCallId: content.toolCallId,
                          toolArgs: content.args,
                        };
                      }
                      return undefined;
                    })
                    ?.filter(Boolean) as Array<{
                    toolCallId: string;
                    toolArgs: Record<string, unknown>;
                  }>;

                  toolCallIds = assistantToolCalls?.map(
                    (toolCall) => toolCall.toolCallId
                  );

                  toolCallArgs = assistantToolCalls?.map(
                    (toolCall) => toolCall.toolArgs
                  );
                  type = assistantContent?.[0]?.type as
                    | 'text'
                    | 'tool-call'
                    | 'tool-result';
                }
                return {
                  id: messageId,
                  threadId: thread.id,
                  role: message.role as any,
                  content: message.content as any,
                  createdAt: new Date(),
                  toolCallIds: toolCallIds?.length ? toolCallIds : undefined,
                  toolCallArgs: toolCallArgs?.length ? toolCallArgs : undefined,
                  type,
                };
              }
            ),
          });
        }
      }
    } catch (err) {
      console.error('Failed to save chat', err);
    }
  }

  sanitizeResponseMessages(
    messages: Array<CoreToolMessage | CoreAssistantMessage>
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

    const messagesBySanitizedContent = messages.map((message) => {
      if (message.role !== 'assistant') return message;

      if (typeof message.content === 'string') return message;

      const sanitizedContent = message.content.filter((content) =>
        content.type === 'tool-call'
          ? toolResultIds.includes(content.toolCallId)
          : content.type === 'text'
            ? content.text.length > 0
            : true
      );

      return {
        ...message,
        content: sanitizedContent,
      };
    });

    return messagesBySanitizedContent.filter(
      (message) => message.content.length > 0
    );
  }

  async text({
    messages,
    onStepFinish,
    maxSteps = 5,
    threadId,
    resourceid,
  }: {
    resourceid?: string;
    threadId?: string;
    messages: UserContent[];
    onStepFinish?: (step: string) => void;
    maxSteps?: number;
  }) {
    this.logger.info(`Starting text generation for agent ${this.name}`);

    const systemMessage: CoreMessage = {
      role: 'system',
      content: this.instructions,
    };

    const userMessages: CoreMessage[] = messages.map((content) => ({
      role: 'user',
      content: content,
    }));

    let coreMessages = userMessages;

    if (this.memory && resourceid) {
      coreMessages = await this.saveMemory({
        threadId,
        resourceid,
        userMessages,
      });
    }

    const messageObjects = [systemMessage, ...coreMessages];

    return this.llm.text({
      model: this.model,
      messages: messageObjects,
      enabledTools: this.enabledTools,
      onStepFinish,
      maxSteps,
    });
  }

  async textObject({
    messages,
    structuredOutput,
    onStepFinish,
    maxSteps = 5,
    threadId,
    resourceid,
  }: {
    resourceid?: string;
    threadId?: string;
    messages: UserContent[];
    structuredOutput: StructuredOutput;
    onStepFinish?: (step: string) => void;
    maxSteps?: number;
  }) {
    this.logger.info(`Starting text generation for agent ${this.name}`);

    const systemMessage: CoreMessage = {
      role: 'system',
      content: this.instructions,
    };

    const userMessages: CoreMessage[] = messages.map((content) => ({
      role: 'user',
      content: content,
    }));

    let coreMessages = userMessages;

    if (this.memory && resourceid) {
      coreMessages = await this.saveMemory({
        threadId,
        resourceid,
        userMessages,
      });
    }

    const messageObjects = [systemMessage, ...coreMessages];

    return this.llm.textObject({
      model: this.model,
      messages: messageObjects,
      structuredOutput,
      enabledTools: this.enabledTools,
      onStepFinish,
      maxSteps,
    });
  }

  async stream({
    messages,
    onStepFinish,
    onFinish,
    maxSteps = 5,
    threadId,
    resourceid,
  }: {
    resourceid?: string;
    threadId?: string;
    messages: UserContent[];
    onStepFinish?: (step: string) => void;
    onFinish?: (result: string) => Promise<void> | void;
    maxSteps?: number;
  }) {
    this.logger.info(`Starting stream generation for agent ${this.name}`);

    const systemMessage: CoreMessage = {
      role: 'system',
      content: this.instructions,
    };

    const userMessages: CoreMessage[] = messages.map((content) => ({
      role: 'user',
      content: content,
    }));

    let coreMessages = userMessages;

    if (this.memory && resourceid) {
      coreMessages = await this.saveMemory({
        threadId,
        resourceid,
        userMessages,
      });
    }

    const messageObjects = [systemMessage, ...coreMessages];

    return this.llm.stream({
      messages: messageObjects,
      model: this.model,
      enabledTools: { ...this.enabledTools, todayTool: true },
      onStepFinish: (step) => {
        console.log('step====', step);
        onStepFinish?.(step);
      },
      onFinish: async (result) => {
        if (this.memory && resourceid) {
          await this.saveMemoryOnFinish({
            result,
            resourceid,
            threadId,
            userMessages,
          });
        }
        onFinish?.(result);
      },
      maxSteps,
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
  }: {
    resourceid?: string;
    threadId?: string;
    messages: UserContent[];
    structuredOutput: StructuredOutput;
    onStepFinish?: (step: string) => void;
    onFinish?: (result: string) => Promise<void> | void;
    maxSteps?: number;
  }) {
    this.logger.info(`Starting stream generation for agent ${this.name}`);

    const systemMessage: CoreMessage = {
      role: 'system',
      content: this.instructions,
    };

    const userMessages: CoreMessage[] = messages.map((content) => ({
      role: 'user',
      content: content,
    }));

    let coreMessages = userMessages;

    if (this.memory && resourceid) {
      coreMessages = await this.saveMemory({
        threadId,
        resourceid,
        userMessages,
      });
    }

    const messageObjects = [systemMessage, ...coreMessages];

    return this.llm.streamObject({
      messages: messageObjects,
      structuredOutput,
      model: this.model,
      enabledTools: this.enabledTools,
      onStepFinish,
      onFinish: async (result) => {
        if (this.memory && resourceid) {
          await this.saveMemoryOnFinish({
            result,
            resourceid,
            threadId,
            userMessages,
          });
        }
        onFinish?.(result);
      },
      maxSteps,
    });
  }
}
