/** Field-level validation error */
export interface FieldError {
  /** JSON Pointer path, e.g., "/name" or "/address/city" */
  path: string;
  /** Zod error code, e.g., "invalid_type", "too_small" */
  code: string;
  /** Human-readable error message */
  message: string;
}

/** Schema validation error with field details */
export class SchemaValidationError extends Error {
  constructor(
    public readonly field: 'input' | 'groundTruth' | 'requestContext',
    public readonly errors: FieldError[],
  ) {
    const summary = errors
      .slice(0, 3)
      .map(e => e.message)
      .join('; ');
    super(`Validation failed for ${field}: ${summary}`);
    this.name = 'SchemaValidationError';
  }
}

/** Batch validation result for multiple items */
export interface BatchValidationResult {
  valid: Array<{ index: number; data: unknown }>;
  invalid: Array<{
    index: number;
    data: unknown;
    field: 'input' | 'groundTruth' | 'requestContext';
    errors: FieldError[];
  }>;
}

/** Error thrown when schema update would invalidate existing items */
export class SchemaUpdateValidationError extends Error {
  constructor(
    public readonly failingItems: Array<{
      index: number;
      data: unknown;
      field: 'input' | 'groundTruth' | 'requestContext';
      errors: FieldError[];
    }>,
  ) {
    const count = failingItems.length;
    super(`Cannot update schema: ${count} existing item(s) would fail validation`);
    this.name = 'SchemaUpdateValidationError';
  }
}
