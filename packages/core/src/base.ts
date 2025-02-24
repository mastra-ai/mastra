import { createLogger, RegisteredLogger } from './logger';
import type { Logger } from './logger';
import type { Telemetry } from './telemetry';

export class MastraBase {
  component: RegisteredLogger = RegisteredLogger.LLM;
  protected logger: Logger;
  name?: string;
  telemetry?: Telemetry;

  constructor({ component, name }: { component?: RegisteredLogger; name?: string }) {
    this.component = component || RegisteredLogger.LLM;
    this.name = name;
    this.logger = createLogger({ name: `${this.component} - ${this.name}` });
  }

  /**
   * Set the logger for the agent
   * @param logger
   */
  __setLogger(logger: Logger) {
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
