import { AssistantContent, CoreMessage, CoreUserMessage, UserContent } from 'ai';
import { ZodSchema } from 'zod';

import { Integration } from '../integration';
import { LLM } from '../llm';
import { ModelConfig, StructuredOutput } from '../llm/types';
import { BaseLogMessage, createLogger, Logger, LogLevel, RegisteredLogger } from '../logger';
import { MastraMemory, ThreadType } from '../memory';
import { Run } from '../run/types';
import { InstrumentClass, Telemetry } from '../telemetry';
import { AllTools, ToolApi } from '../tools/types';

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

    this.llm = new LLM<TTools, TIntegrations, TKeys>();

    this.model = config.model;
    this.enabledTools = config.enabledTools || {};
    this.#logger = createLogger({ type: 'CONSOLE' });
    this.#logger.info(`Agent ${this.name} initialized with model ${this.model.provider}`);
  }

  /**
   * Set the concrete tools for the agent
   * @param tools
   */
  __setTools(tools: Record<TKeys, ToolApi>) {
    this.llm.__setTools(tools);
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

  __setMemory(memory: MastraMemory) {
    this.memory = memory;
  }

  async generateTitleFromUserMessage({ message }: { message: CoreUserMessage }) {
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
    const userMessages = messages.filter(message => message.role === 'user');
    return userMessages.at(-1);
  }

  async saveMemory({ threadId, userMessages }: { threadId?: string; userMessages: CoreMessage[] }) {
    if (this.memory) {
      let thread: ThreadType | null;
      if (!threadId) {
        const userMessage = this.getMostRecentUserMessage(userMessages);
        let title = 'New Thread';
        try {
          if (userMessage) {
            title = await this.generateTitleFromUserMessage({ message: userMessage });
          }
        } catch (e) {
          console.error('Error generating title:', e);
        }

        thread = await this.memory.createThread(title);
      } else {
        thread = await this.memory.getThreadById({ threadId });
      }

      if (thread) {
        const messages = userMessages.map(u => {
          return {
            id: this.memory?.generateId()!,
            createdAt: new Date(),
            threadId: thread.id,
            ...u,
            content: u.content as UserContent | AssistantContent,
            role: u.role as 'user' | 'assistant',
          };
        });

        await this.memory.saveMessages({ messages });
        console.log('Memory here.');
      }
    }
  }

  async text({
    messages,
    onStepFinish,
    maxSteps = 5,
    runId,
    threadId,
  }: {
    threadId?: string;
    messages: UserContent[];
    onStepFinish?: (step: string) => void;
    maxSteps?: number;
  } & Run) {
    this.#log(LogLevel.INFO, `Starting text generation for agent ${this.name}`, runId);

    const systemMessage: CoreMessage = {
      role: 'system',
      content: this.instructions,
    };

    const userMessages: CoreMessage[] = messages.map(content => ({
      role: 'user',
      content: content,
    }));

    if (this.memory) {
      await this.saveMemory({
        threadId,
        userMessages,
      });
    }

    const messageObjects = [systemMessage, ...userMessages];

    return this.llm.text({
      model: this.model,
      messages: messageObjects,
      enabledTools: this.enabledTools,
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
    runId,
    threadId,
  }: {
    threadId?: string;
    messages: UserContent[];
    structuredOutput: StructuredOutput | ZodSchema;
    onStepFinish?: (step: string) => void;
    maxSteps?: number;
  } & Run) {
    this.#log(LogLevel.INFO, `Starting text generation for agent ${this.name}`, runId);

    const systemMessage: CoreMessage = {
      role: 'system',
      content: this.instructions,
    };

    const userMessages: CoreMessage[] = messages.map(content => ({
      role: 'user',
      content: content,
    }));

    if (this.memory) {
      await this.saveMemory({
        threadId,
        userMessages,
      });
    }

    const messageObjects = [systemMessage, ...userMessages];

    return this.llm.textObject({
      model: this.model,
      messages: messageObjects,
      structuredOutput,
      enabledTools: this.enabledTools,
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
    runId,
    threadId,
  }: {
    threadId?: string;
    messages: UserContent[];
    onStepFinish?: (step: string) => void;
    onFinish?: (result: string) => Promise<void> | void;
    maxSteps?: number;
  } & Run) {
    this.#log(LogLevel.INFO, `Starting stream generation for agent ${this.name}`, runId);

    if (this.memory) {
      console.log('Memory here.');
    }

    const systemMessage: CoreMessage = {
      role: 'system',
      content: this.instructions,
    };

    const userMessages: CoreMessage[] = messages.map(content => ({
      role: 'user',
      content: content,
    }));

    if (this.memory) {
      await this.saveMemory({
        threadId,
        userMessages,
      });
    }

    const messageObjects = [systemMessage, ...userMessages];

    return this.llm.stream({
      messages: messageObjects,
      model: this.model,
      enabledTools: this.enabledTools,
      onStepFinish,
      onFinish,
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
    runId,
    threadId,
  }: {
    threadId?: string;
    messages: UserContent[];
    structuredOutput: StructuredOutput | ZodSchema;
    onStepFinish?: (step: string) => void;
    onFinish?: (result: string) => Promise<void> | void;
    maxSteps?: number;
  } & Run) {
    this.#log(LogLevel.INFO, `Starting stream generation for agent ${this.name}`, runId);

    if (this.memory) {
      console.log('Memory here.');
    }

    const systemMessage: CoreMessage = {
      role: 'system',
      content: this.instructions,
    };

    const userMessages: CoreMessage[] = messages.map(content => ({
      role: 'user',
      content: content,
    }));

    if (this.memory) {
      await this.saveMemory({
        threadId,
        userMessages,
      });
    }

    const messageObjects = [systemMessage, ...userMessages];

    return this.llm.streamObject({
      messages: messageObjects,
      structuredOutput,
      model: this.model,
      enabledTools: this.enabledTools,
      onStepFinish,
      onFinish,
      maxSteps,
      runId,
    });
  }
}
