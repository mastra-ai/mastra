/**
 * Logger interface for MastraAdmin.
 */
export interface AdminLogger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

/**
 * Console logger implementation.
 */
export class ConsoleAdminLogger implements AdminLogger {
  private readonly name: string;

  constructor(name: string = 'MastraAdmin') {
    this.name = name;
  }

  private format(level: string, message: string, data?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level}] [${this.name}] ${message}${dataStr}`;
  }

  debug(message: string, data?: Record<string, unknown>): void {
    // Use console.info for debug since console.debug is not allowed by eslint config
    console.info(this.format('DEBUG', message, data));
  }

  info(message: string, data?: Record<string, unknown>): void {
    console.info(this.format('INFO', message, data));
  }

  warn(message: string, data?: Record<string, unknown>): void {
    console.warn(this.format('WARN', message, data));
  }

  error(message: string, data?: Record<string, unknown>): void {
    console.error(this.format('ERROR', message, data));
  }
}

/**
 * No-op logger for silent operation.
 */
export class NoopAdminLogger implements AdminLogger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}
