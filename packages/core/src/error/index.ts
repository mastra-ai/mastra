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

type Scalar = null | boolean | number | string;

type Json<T> = [T] extends [Scalar | undefined]
  ? Scalar
  : [T] extends [{ [x: number]: unknown }]
    ? { [K in keyof T]: Json<T[K]> }
    : never;

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
  text: string;
  /**
   * Functional domain of the error (e.g., CONFIG, BUILD, API).
   */
  domain: `${Domain}`;
  /** Broad category of the error (e.g., USER, SYSTEM, THIRD_PARTY). */
  category: `${ErrorCategory}`;

  details?: Record<string, Json<Scalar>>;
}

/**
 * Base error class for the Mastra ecosystem.
 * It standardizes error reporting and can be extended for more specific error types.
 */
export class MastraError extends Error {
  public readonly id: string | number;
  public readonly domain: `${Domain}`;
  public readonly category: `${ErrorCategory}`;
  public readonly originalError?: Error;
  public readonly details?: Record<string, Json<Scalar>> = {};

  constructor(errorDefinition: IErrorDefinition, originalError?: Error | MastraError) {
    const message = errorDefinition.text;

    super(message, originalError);

    this.id = errorDefinition.id;
    this.domain = errorDefinition.domain;
    this.category = errorDefinition.category;
    this.originalError = originalError;
    this.details = errorDefinition.details ?? {};

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
      details: this.details,
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

const error = new MastraError({
  id: 'BASE_TEST_001',
  text: 'This is a base test error',
  domain: Domain.AGENT,
  category: ErrorCategory.UNKNOWN,
  details: {
    tset: 'lalal',
  },
});

console.log(error.toJSON());
