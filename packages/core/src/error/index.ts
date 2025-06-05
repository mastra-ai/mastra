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
  THIRD_PARTY = 'THIRD_PARTY',
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
  id: Uppercase<string>;
  /**
   * The error message template or a function to generate it.
   * If a function, it receives context to interpolate values.
   */
  text: string;
  /**
   * Functional domain of the error (e.g., CONFIG, BUILD, API).
   */
  domain: `${Domain | Uppercase<string>}`;
  /** Broad category of the error (e.g., USER, SYSTEM, THIRD_PARTY). */
  category: `${ErrorCategory | Uppercase<string>}`;

  details?: Record<string, Json<Scalar>>;
}

/**
 * Base error class for the Mastra ecosystem.
 * It standardizes error reporting and can be extended for more specific error types.
 */
export class MastraError extends Error {
  public readonly id: Uppercase<string>;
  public readonly domain: `${Domain | Uppercase<string>}`;
  public readonly category: `${ErrorCategory | Uppercase<string>}`;
  public readonly originalError?: Error;
  public readonly details?: Record<string, Json<Scalar>> = {};

  constructor(errorDefinition: IErrorDefinition, originalError?: Error | MastraError | unknown) {
    const message = errorDefinition.text;
    let error;
    if (originalError instanceof Error) {
      error = originalError;
    } else if (originalError) {
      error = new Error(String(originalError));
    }

    super(message, error);
    this.id = errorDefinition.id;
    this.domain = errorDefinition.domain;
    this.category = errorDefinition.category;
    this.originalError = error;
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
