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
   * Can be a static domain or a function deriving domain from context.
   */
  domain: Domain | ((context: IErrorContext) => Domain);
  /** Broad category of the error (e.g., USER, SYSTEM, THIRD_PARTY). */
  category: ErrorCategory;
}

/**
 * Base error class for the Mastra ecosystem.
 * It standardizes error reporting and can be extended for more specific error types.
 */
export class MastraError<T extends IErrorContext> extends Error {
  public readonly id: string | number;
  public readonly domain: Domain;
  public readonly category: ErrorCategory;
  public readonly message: string;
  public readonly originalError?: Error;

  constructor(errorDefinition: IErrorDefinition, context: T, originalError?: Error | MastraError<T>) {
    const message =
      typeof errorDefinition.text === 'function' ? errorDefinition.text(context || {}) : errorDefinition.text;

    super(message, originalError);
    this.message = message;

    this.id = errorDefinition.id;

    this.domain =
      typeof errorDefinition.domain === 'function' ? errorDefinition.domain(context || {}) : errorDefinition.domain;

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

export function makeMastraError<T extends IErrorContext>(definition: IErrorDefinition) {
  return class extends MastraError<T> {
    constructor(context: T, originalError?: Error) {
      super(definition, context, originalError);
    }
  };
}

export const MASTRA_ERRORS = {
  TOOL_EXECUTE_ERROR: makeMastraError<{ toolName: string }>({
    id: 'TOOL_EXECUTE_ERROR',
    text: ctx => `Tool ${ctx.toolName} failed to execute`,
    domain: Domain.TOOL,
    category: ErrorCategory.USER,
  }),
};

throw new MASTRA_ERRORS.TOOL_EXECUTE_ERROR({ toolName: 'test' });
/**
 * Example of how MastraError can be extended if you prefer dedicated error classes
 * for certain groups of errors, potentially with their own error map.
 *
 * export const CustomErrorMap: Record<string, IErrorDefinition> = {
 *   "MODULE_XYZ_001": {
 *     id: "MODULE_XYZ_001",
 *     text: (ctx: IErrorContext) => `Module XYZ operation failed for item: ${ctx.itemId}. Details: ${ctx.details}`,
 *     // Assuming Domain.AGENT is a relevant domain from your enum
 *     domain: Domain.AGENT,
 *     category: ErrorCategory.SYSTEM,
 *   },
 * };
 *
 * // This custom error class would take a context of type IErrorContext by default
 * // or could be made generic itself if its specific errors need varying context types.
 * export class ModuleXyzError extends MastraError<IErrorContext> {
 *   constructor(errorCode: keyof typeof CustomErrorMap, context: IErrorContext, cause?: Error) {
 *     const definition = CustomErrorMap[errorCode];
 *     if (!definition) {
 *       // Fallback for an unknown error code within this specific error domain
 *       super(
 *         {
 *           id: errorCode,
 *           text: (ctx: IErrorContext) => `Unknown Module XYZ error: ${errorCode}. Context: ${JSON.stringify(ctx)}`,
 *           // Provide a sensible default domain and category for unknown errors of this type
 *           domain: Domain.AGENT,
 *           category: ErrorCategory.UNKNOWN,
 *         },
 *         context,
 *         cause
 *       );
 *     } else {
 *       super(definition, context, cause);
 *     }
 *   }
 * }
 *
 * // Example usage:
 * // throw new ModuleXyzError("MODULE_XYZ_001", { itemId: "item123", details: "Network timeout" });
 */
