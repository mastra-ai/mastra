import type { IMastraLogger } from './logger';
import { RegisteredLogger } from './logger/constants';
import { ConsoleLogger } from './logger/default-logger';

export class MastraBase {
  component: RegisteredLogger = RegisteredLogger.LLM;
  protected logger: IMastraLogger;
  name?: string;

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
   * Normalizes perPage input for pagination queries.
   *
   * @param perPageInput - The raw perPage value from the user
   * @param defaultValue - The default perPage value to use when undefined (typically 40 for messages, 100 for threads)
   * @returns A numeric perPage value suitable for queries (false becomes MAX_SAFE_INTEGER, negative values fall back to default)
   */
  protected normalizePerPage(perPageInput: number | false | undefined, defaultValue: number): number {
    if (perPageInput === false) {
      return Number.MAX_SAFE_INTEGER; // Get all results
    } else if (perPageInput === 0) {
      return 0; // Return zero results
    } else if (typeof perPageInput === 'number' && perPageInput > 0) {
      return perPageInput; // Valid positive number
    }
    // For undefined, negative, or other invalid values, use default
    return defaultValue;
  }

  /**
   * Preserves the original perPage value for API responses.
   * When perPageInput is false, returns false; otherwise returns the normalized numeric value.
   *
   * @param perPageInput - The raw perPage value from the user
   * @param normalizedValue - The normalized numeric value from normalizePerPage
   * @returns The value to include in the response (preserves false when input was false)
   */
  protected preservePerPageForResponse(
    perPageInput: number | false | undefined,
    normalizedValue: number,
  ): number | false {
    return perPageInput === false ? false : normalizedValue;
  }
}

export * from './types';
