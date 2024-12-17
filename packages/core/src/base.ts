import { createLogger, Logger, BaseLogMessage, LogLevel, RegisteredLogger } from './logger';
import { Telemetry } from './telemetry';

export class MastraBase {
  component: RegisteredLogger = RegisteredLogger.LLM;
  logger: Logger;
  name?: string;
  telemetry?: Telemetry;

  constructor({ component, name }: { component: RegisteredLogger; name?: string }) {
    this.component = component;
    this.name = name;
    this.logger = createLogger({ type: 'CONSOLE' });
  }

  /**
   * Set the logger for the agent
   * @param logger
   */
  __setLogger(logger: Logger) {
    this.logger = logger;
    this.log(LogLevel.DEBUG, `Logger updated for LLM `);
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

    const logMethod = level.toLowerCase() as keyof Logger<BaseLogMessage>;
    this.logger[logMethod]?.(logMessage);
  }

  /**
   * Set the telemetry for the
   * @param telemetry
   */
  __setTelemetry(telemetry: Telemetry) {
    this.telemetry = telemetry;
    this.log(LogLevel.DEBUG, `Telemetry updated for ${this.component} ${this.telemetry.tracer}`);
  }

  /* 
    get experimental_telemetry config
    */
  get experimental_telemetry() {
    return this.telemetry
      ? {
          tracer: this.telemetry.tracer,
          isEnabled: !!this.telemetry.tracer,
        }
      : undefined;
  }
}
