import { CoreMessage, UserContent } from 'ai';
import { Integration } from '../integration';
import { createLogger, Logger } from '../logger';
import { AllTools, ToolApi } from '../tools/types';
import { LLM, ModelConfig } from '../llm';

export class Agent<
  TIntegrations extends Integration[] | undefined = undefined,
  TTools extends Record<string, ToolApi<TIntegrations>> | undefined = undefined,
  TKeys extends keyof AllTools<TIntegrations, TTools> = keyof AllTools<
    TIntegrations,
    TTools
  >,
> {
  public name: string;
  readonly llm: LLM<TIntegrations, TTools, TKeys>;
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

    this.llm = new LLM<TIntegrations, TTools, TKeys>();

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

  async text({
    messages,
    onStepFinish,
    maxSteps = 5,
  }: {
    messages: UserContent[];
    onStepFinish?: (step: string) => void;
    maxSteps?: number;
  }) {
    this.logger.info(`Starting text generation for agent ${this.name}`);

    const messageObjects: CoreMessage[] = messages.map((content) => ({
      role: 'user',
      content,
    }));

    messageObjects.push({
      role: 'system',
      content: this.instructions,
    });

    return this.llm.text({
      model: this.model,
      messages: messageObjects,
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
  }: {
    messages: UserContent[];
    onStepFinish?: (step: string) => void;
    onFinish?: (result: string) => Promise<void> | void;
    maxSteps?: number;
  }) {
    this.logger.info(`Starting stream generation for agent ${this.name}`);

    const messageObjects: CoreMessage[] = messages.map((content) => ({
      role: 'user',
      content,
    }));

    messageObjects.push({
      role: 'system',
      content: this.instructions,
    });

    return this.llm.stream({
      messages: messageObjects,
      model: this.model,
      enabledTools: this.enabledTools,
      onStepFinish,
      onFinish,
      maxSteps,
    });
  }
}
