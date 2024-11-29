import { CoreMessage, UserContent } from 'ai';
import { Integration } from '../integration';
import { BaseLogMessage, createLogger, Logger, LogLevel, RegisteredLogger } from '../logger';
import { AllTools, ToolApi } from '../tools/types';
import { LLM } from '../llm';
import { ModelConfig, StructuredOutput } from '../llm/types';
import { Run } from '../run/types';

export class Agent<
  TTools,
  TIntegrations extends Integration[] | undefined = undefined,
  TKeys extends keyof AllTools<TTools, TIntegrations> = keyof AllTools<
    TTools,
    TIntegrations
  >,
> {
  public name: string;
  readonly llm: LLM<TTools, TIntegrations, TKeys>;
  readonly instructions: string;
  readonly model: ModelConfig;
  readonly enabledTools: Partial<Record<TKeys, boolean>>;
  #logger: Logger;

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
    this.#logger.info(
      `Agent ${this.name} initialized with model ${this.model.provider}`
    );
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
   * Internal logging helper that formats and sends logs to the configured logger
   * @param level - Severity level of the log
   * @param message - Main log message
   * @param runId - Optional runId for the log
   */
  #log (level: LogLevel, message: string, runId?: string) {
    if (!this.#logger) return;

    const logMessage: BaseLogMessage = {
      type: RegisteredLogger.AGENT,
      message,
      destinationPath: 'AGENT',
      runId
    };

    const logMethod = level.toLowerCase() as keyof Logger<BaseLogMessage>;

    this.#logger[logMethod]?.(logMessage);
  }


  async text({
    messages,
    onStepFinish,
    maxSteps = 5,
    runId
  }: {
    messages: UserContent[];
    onStepFinish?: (step: string) => void;
    maxSteps?: number;
  } & Run) {
    this.#log(LogLevel.INFO, `Starting text generation for agent ${this.name}`, runId);

    const systemMessage: CoreMessage = {
      role: 'system',
      content: this.instructions,
    };

    const userMessages: CoreMessage[] = messages.map((content) => ({
      role: 'user',
      content: content,
    }));

    const messageObjects = [systemMessage, ...userMessages];

    return this.llm.text({
      model: this.model,
      messages: messageObjects,
      enabledTools: this.enabledTools,
      onStepFinish,
      maxSteps,
      runId
    });
  }

  async textObject({
    messages,
    structuredOutput,
    onStepFinish,
    maxSteps = 5,
    runId
  }: {
    messages: UserContent[];
    structuredOutput: StructuredOutput;
    onStepFinish?: (step: string) => void;
    maxSteps?: number;
  } & Run) {
    this.#log(LogLevel.INFO, `Starting text generation for agent ${this.name}`, runId);

    const systemMessage: CoreMessage = {
      role: 'system',
      content: this.instructions,
    };

    const userMessages: CoreMessage[] = messages.map((content) => ({
      role: 'user',
      content: content,
    }));

    const messageObjects = [systemMessage, ...userMessages];

    return this.llm.textObject({
      model: this.model,
      messages: messageObjects,
      structuredOutput,
      enabledTools: this.enabledTools,
      onStepFinish,
      maxSteps,
      runId
    });
  }

  async stream({
    messages,
    onStepFinish,
    onFinish,
    maxSteps = 5,
    runId
  }: {
    messages: UserContent[];
    onStepFinish?: (step: string) => void;
    onFinish?: (result: string) => Promise<void> | void;
    maxSteps?: number;
  } & Run) {
    this.#log(LogLevel.INFO, `Starting stream generation for agent ${this.name}`, runId);

    const systemMessage: CoreMessage = {
      role: 'system',
      content: this.instructions,
    };

    const userMessages: CoreMessage[] = messages.map((content) => ({
      role: 'user',
      content: content,
    }));

    const messageObjects = [systemMessage, ...userMessages];

    return this.llm.stream({
      messages: messageObjects,
      model: this.model,
      enabledTools: this.enabledTools,
      onStepFinish,
      onFinish,
      maxSteps,
      runId
    });
  }

  async streamObject({
    messages,
    structuredOutput,
    onStepFinish,
    onFinish,
    maxSteps = 5,
    runId
  }: {
    messages: UserContent[];
    structuredOutput: StructuredOutput;
    onStepFinish?: (step: string) => void;
    onFinish?: (result: string) => Promise<void> | void;
    maxSteps?: number;
  } & Run) {
    this.#log(LogLevel.INFO, `Starting stream generation for agent ${this.name}`, runId);

    const systemMessage: CoreMessage = {
      role: 'system',
      content: this.instructions,
    };

    const userMessages: CoreMessage[] = messages.map((content) => ({
      role: 'user',
      content: content,
    }));

    const messageObjects = [systemMessage, ...userMessages];

    return this.llm.streamObject({
      messages: messageObjects,
      structuredOutput,
      model: this.model,
      enabledTools: this.enabledTools,
      onStepFinish,
      onFinish,
      maxSteps,
      runId
    });
  }
}
