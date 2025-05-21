import type { IMastraLogger } from './logger';
import { RegisteredLogger } from './logger/constants';
import { ConsoleLogger } from './logger/default-logger';

import type { Telemetry } from './telemetry';

export class MastraBase {
  component: RegisteredLogger = RegisteredLogger.LLM;
  protected logger: IMastraLogger;
  name?: string;
  telemetry?: Telemetry;

  constructor({ component, name }: { component?: RegisteredLogger; name?: string }) {
    this.component = component || RegisteredLogger.LLM;
    this.name = name;
    this.logger = new ConsoleLogger({ name: `${this.component} - ${this.name}` });
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

  /**
   * Set the telemetry for the
   * @param telemetry
   */
  __setTelemetry(telemetry: Telemetry) {
    this.telemetry = telemetry;

    if (this.component !== RegisteredLogger.LLM) {
      this.logger.debug(`Telemetry updated [component=${this.component}] [name=${this.telemetry.name}]`);
    }
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
