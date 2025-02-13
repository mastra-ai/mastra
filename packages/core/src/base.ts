import { createLogger, Logger, type BaseLogMessage, LogLevel, RegisteredLogger } from './logger';
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
    this.logger.debug(`Logger updated for ${this.component}:${this.name}`);
  }

  /**
   * Internal logging helper that formats and sends logs to the configured logger
   * @param level - Severity level of the log
   * @param message - Main log message
   * @param opts - Optional object for the log
   */
  log(level: LogLevel, message: string, opts?: Record<string, any>) {
    if (!this.logger) return;

    const logMessage: BaseLogMessage = {
      type: this.component,
      message,
      destinationPath: this.name ? `${this.component}/${this.name}` : this.component,
      ...(opts || {}),
    };

    const logMethod = level.toLowerCase() as keyof Logger;
    (this.logger as any)[logMethod]?.(logMessage);
  }

  /**
   * Set the telemetry for the
   * @param telemetry
   */
  __setTelemetry(telemetry: Telemetry) {
    this.telemetry = telemetry;
    this.logger.debug(`Telemetry updated for ${this.component} ${this.telemetry.tracer}`);
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
