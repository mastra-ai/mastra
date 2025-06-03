export enum Level {
  ERROR = 'ERROR',
  WARNING = 'WARNING',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
}

export enum Domain {
  TOOL = 'TOOL',
  AGENT = 'AGENT',
  MCP = 'MCP',
  UNKNOWN = 'UNKNOWN',
}

export enum ErrorCategory {
  UNKNOWN = 'UNKNOWN',
  USER = 'USER',
  SYSTEM = 'SYSTEM',
}

export interface IErrorContext {
  [key: string]: any;
}

/**
 * Defines the structure for an error's metadata.
 * This is used to create instances of MastraError.
 */
export interface IErrorDefinition {
  /** Unique identifier for the error. */
  id: string | number;
  /**
   * The error message template or a function to generate it.
   * If a function, it receives context to interpolate values.
   */
  text: string | ((context: IErrorContext) => string);
  /**
   * Functional domain of the error (e.g., CONFIG, BUILD, API).
   */
  domain: `${Domain}`;
  /** Broad category of the error (e.g., USER, SYSTEM, THIRD_PARTY). */
  category: `${ErrorCategory}`;
}

/**
 * Base error class for the Mastra ecosystem.
 * It standardizes error reporting and can be extended for more specific error types.
 */
export class MastraError<T extends IErrorContext> extends Error {
  public readonly id: string | number;
  public readonly domain: `${Domain}`;
  public readonly category: `${ErrorCategory}`;
  public readonly originalError?: Error;

  constructor(errorDefinition: IErrorDefinition, context: T = {} as T, originalError?: Error | MastraError<T>) {
    const message = typeof errorDefinition.text === 'function' ? errorDefinition.text(context) : errorDefinition.text;

    super(message, originalError);

    this.id = errorDefinition.id;
    this.domain = errorDefinition.domain;
    this.category = errorDefinition.category;
    this.originalError = originalError;

    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Returns a structured representation of the error, useful for logging or API responses.
   */
  public toJSONDetails() {
    return {
      message: this.message,
      domain: this.domain,
      category: this.category,
      stack: this.stack,
      originalError: this.originalError,
    };
  }

  public toJSON() {
    return {
      message: this.message,
      details: this.toJSONDetails(),
      code: this.id,
    };
  }
}
