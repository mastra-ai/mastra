export enum ErrorDomain {
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
export interface IErrorDefinition<D, C> {
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
  domain: D;
  /** Broad category of the error (e.g., USER, SYSTEM, THIRD_PARTY). */
  category: C;

  details?: Record<string, Json<Scalar>>;
}

/**
 * Base error class for the Mastra ecosystem.
 * It standardizes error reporting and can be extended for more specific error types.
 */
export class MastraBaseError<D, C> extends Error {
  public readonly id: Uppercase<string>;
  public readonly domain: D;
  public readonly category: C;
  public readonly stack?: string;
  public readonly details?: Record<string, Json<Scalar>> = {};

  constructor(errorDefinition: IErrorDefinition<D, C>, originalError?: Error | MastraBaseError<D, C> | unknown) {
    const message = errorDefinition.text;
    let error;
    if (originalError instanceof Error) {
      error = originalError;
    } else if (originalError) {
      error = new Error(String(originalError));
    }

    super(message, { cause: error });
    this.id = errorDefinition.id;
    this.domain = errorDefinition.domain;
    this.category = errorDefinition.category;
    this.stack = error?.stack;
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

  public toString() {
    return JSON.stringify(this.toJSON());
  }
}

export class MastraError extends MastraBaseError<ErrorDomain, ErrorCategory> {}
