import type { BaseLogger } from './logger/base-logger';
import { noopLogger } from './logger/no-op-logger';
import type { LogLevel } from './logger/types';
import { RegisteredLogger } from './logger/types';
import type { Telemetry } from './telemetry';

export abstract class MastraBase {
  protected logger: BaseLogger;
  component: RegisteredLogger;
  name?: string;
  telemetry?: Telemetry;

  constructor({
    component,
    name,
    createLogger,
  }: {
    component?: RegisteredLogger;
    name?: string;
    createLogger?: (options: { name?: string; level?: LogLevel }) => BaseLogger;
  }) {
    this.component = component || RegisteredLogger.LLM;
    this.name = name;
    this.logger = createLogger ? createLogger({ name: `${this.component} - ${this.name}` }) : noopLogger;
  }

  /**
   * Set the logger for the agent
   * @param logger
   */
  __setLogger(logger: BaseLogger) {
    this.logger = logger;
    this.logger.debug(`Logger updated [component=${this.component}] [name=${this.name}]`);
  }

  /**
   * Set the telemetry for the
   * @param telemetry
   */
  __setTelemetry(telemetry: Telemetry) {
    this.telemetry = telemetry;
    this.logger.debug(`Telemetry updated [component=${this.component}] [tracer=${this.telemetry.tracer}]`);
  }

  /**
   * Get the telemetry on the vector
   * @returns telemetry
   */
  __getTelemetry() {
    return this.telemetry;
  }

  /* 
    get experimental_telemetry config
    */
  get experimental_telemetry() {
    return this.telemetry
      ? {
          // tracer: this.telemetry.tracer,
          tracer: this.telemetry.getBaggageTracer(),
          isEnabled: !!this.telemetry.tracer,
        }
      : undefined;
  }
}
