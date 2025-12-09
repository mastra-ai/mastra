import { getErrorFromUnknown } from './utils.js';
import type { SerializableError, SerializedError } from './utils.js';

export { getErrorFromUnknown };
export type { SerializableError, SerializedError };

export enum ErrorDomain {
  TOOL = 'TOOL',
  AGENT = 'AGENT',
  MCP = 'MCP',
  AGENT_NETWORK = 'AGENT_NETWORK',
  MASTRA_SERVER = 'MASTRA_SERVER',
  MASTRA_OBSERVABILITY = 'MASTRA_OBSERVABILITY',
  MASTRA_WORKFLOW = 'MASTRA_WORKFLOW',
  MASTRA_VOICE = 'MASTRA_VOICE',
  MASTRA_VECTOR = 'MASTRA_VECTOR',
  LLM = 'LLM',
  EVAL = 'EVAL',
  SCORER = 'SCORER',
  A2A = 'A2A',
  MASTRA_INSTANCE = 'MASTRA_INSTANCE',
  MASTRA = 'MASTRA',
  DEPLOYER = 'DEPLOYER',
  STORAGE = 'STORAGE',
  MODEL_ROUTER = 'MODEL_ROUTER',
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
export interface IErrorDefinition<DOMAIN, CATEGORY> {
  /** Unique identifier for the error. */
  id: Uppercase<string>;
  /**
   * Optional custom error message that overrides the original error message.
   * If not provided, the original error message will be used, or 'Unknown error' if no error is provided.
   */
  text?: string;
  /**
   * Functional domain of the error (e.g., CONFIG, BUILD, API).
   */
  domain: DOMAIN;
  /** Broad category of the error (e.g., USER, SYSTEM, THIRD_PARTY). */
  category: CATEGORY;

  details?: Record<string, Json<Scalar>>;
}

/**
 * JSON representation of a MastraError for serialization
 */
export interface MastraErrorJSON<DOMAIN = string, CATEGORY = string> {
  message: string;
  code: Uppercase<string>;
  category: CATEGORY;
  domain: DOMAIN;
  details?: Record<string, Json<Scalar>>;
  cause?: ReturnType<SerializableError['toJSON']>;
}

/**
 * Base error class for the Mastra ecosystem.
 * It standardizes error reporting and can be extended for more specific error types.
 */
export class MastraBaseError<DOMAIN, CATEGORY> extends Error {
  public readonly id: Uppercase<string>;
  public readonly domain: DOMAIN;
  public readonly category: CATEGORY;
  public readonly details?: Record<string, Json<Scalar>> = {};
  public readonly message: string;
  public cause?: SerializableError;

  constructor(
    errorDefinition: IErrorDefinition<DOMAIN, CATEGORY>,
    originalError?: string | Error | MastraBaseError<DOMAIN, CATEGORY> | unknown,
  ) {
    const error = originalError
      ? getErrorFromUnknown(originalError, {
          serializeStack: false,
          fallbackMessage: 'Unknown error',
        })
      : undefined;

    const message = errorDefinition.text ?? error?.message ?? 'Unknown error';

    super(message, { cause: error });
    this.id = errorDefinition.id;
    this.domain = errorDefinition.domain;
    this.category = errorDefinition.category;
    this.details = errorDefinition.details ?? {};
    this.message = message;
    this.cause = error;

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
      details: this.details,
    };
  }

  public toJSON(): MastraErrorJSON<DOMAIN, CATEGORY> {
    return {
      message: this.message,
      domain: this.domain,
      category: this.category,
      code: this.id,
      details: this.details,
      cause: this.cause?.toJSON?.(),
    };
  }

  public toString() {
    return JSON.stringify(this.toJSON());
  }
}

export class MastraError extends MastraBaseError<`${ErrorDomain}`, `${ErrorCategory}`> {}
