import type { IMastraLogger } from './logger';
import { RegisteredLogger } from './logger/constants';
import { ConsoleLogger } from './logger/default-logger';

export class MastraBase {
  component: RegisteredLogger = RegisteredLogger.LLM;
  protected logger: IMastraLogger;
  name?: string;
  #rawConfig?: Record<string, unknown>;

  constructor({
    component,
    name,
    rawConfig,
  }: {
    component?: RegisteredLogger;
    name?: string;
    rawConfig?: Record<string, unknown>;
  }) {
    this.component = component || RegisteredLogger.LLM;
    this.name = name;
    this.#rawConfig = rawConfig;
    this.logger = new ConsoleLogger({ name: `${this.component} - ${this.name}` });
  }

  /**
   * Returns the raw storage configuration this primitive was created from,
   * or undefined if it was created from code.
   */
  toRawConfig(): Record<string, unknown> | undefined {
    return this.#rawConfig;
  }

  /**
   * Sets the raw storage configuration for this primitive.
   * @internal
   */
  __setRawConfig(rawConfig: Record<string, unknown>): void {
    this.#rawConfig = rawConfig;
  }

  /**
   * Set the logger for the agent
   * @param logger
   */
  __setLogger(logger: IMastraLogger) {
    this.logger = logger;

    if (this.component !== RegisteredLogger.LLM) {
      this.logger.debug(`Logger updated [component=${this.component}] [name=${this.name}]`);
    }
  }
}

export * from './types';
