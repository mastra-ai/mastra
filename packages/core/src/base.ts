import { createLogger, Logger, BaseLogMessage, LogLevel, RegisteredLogger } from './logger';
import { Telemetry } from './telemetry';

export class MastraBase {
  component: RegisteredLogger = RegisteredLogger.LLM;
  logger: Logger;
  telemetry?: Telemetry;

  constructor({ component }: { component: RegisteredLogger }) {
    this.component = component;
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
   * @param runId - Optional runId for the log
   */
  log(level: LogLevel, message: string, runId?: string) {
    if (!this.logger) return;

    const logMessage: BaseLogMessage = {
      type: this.component,
      message,
      destinationPath: this.component,
      runId,
    };

    const logMethod = level.toLowerCase() as keyof Logger<BaseLogMessage>;
    this.logger[logMethod]?.(logMessage);
  }

  /**
   * Set the telemetry for the agent
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
