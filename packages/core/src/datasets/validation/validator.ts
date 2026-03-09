import { jsonSchemaToZod } from '@mastra/schema-compat/json-to-zod';
import type { JSONSchema7 } from 'json-schema';
import { z } from 'zod';
import type { ZodSchema, ZodError, ZodIssue } from 'zod';
import { SchemaValidationError } from './errors';
import type { FieldError, BatchValidationResult } from './errors';

/**
 * Convert JSON Schema string to runtime Zod schema.
 * Uses Function() to evaluate the generated Zod code - same pattern as workflow validation.
 */
function resolveZodSchema(zodString: string): ZodSchema {
  return Function('z', `"use strict";return (${zodString});`)(z);
}

/** Schema validator with compilation caching */
export class SchemaValidator {
  private cache = new Map<string, ZodSchema>();

  /** Get or compile validator for schema */
  private getValidator(schema: JSONSchema7, cacheKey: string): ZodSchema {
    let zodSchema = this.cache.get(cacheKey);
    if (!zodSchema) {
      const zodString = jsonSchemaToZod(schema);
      zodSchema = resolveZodSchema(zodString);
      this.cache.set(cacheKey, zodSchema);
    }
    return zodSchema;
  }

  /** Clear cached validator (call when schema changes) */
  clearCache(cacheKey: string): void {
    this.cache.delete(cacheKey);
  }

  /** Validate data against schema */
  validate(
    data: unknown,
    schema: JSONSchema7,
    field: 'input' | 'groundTruth' | 'requestContext',
    cacheKey: string,
  ): void {
    const zodSchema = this.getValidator(schema, cacheKey);
    const result = zodSchema.safeParse(data);
    if (!result.success) {
      throw new SchemaValidationError(field, this.formatErrors(result.error));
    }
  }

  /** Validate multiple items, returning valid/invalid split */
  validateBatch(
    items: Array<{ input: unknown; groundTruth?: unknown; requestContext?: unknown }>,
    inputSchema: JSONSchema7 | null | undefined,
    outputSchema: JSONSchema7 | null | undefined,
    cacheKeyPrefix: string,
    maxErrors = 10,
    requestContextSchema?: JSONSchema7 | null,
  ): BatchValidationResult {
    const result: BatchValidationResult = { valid: [], invalid: [] };

    // Pre-compile schemas for performance
    const inputValidator = inputSchema ? this.getValidator(inputSchema, `${cacheKeyPrefix}:input`) : null;
    const outputValidator = outputSchema ? this.getValidator(outputSchema, `${cacheKeyPrefix}:output`) : null;
    const requestContextValidator = requestContextSchema
      ? this.getValidator(requestContextSchema, `${cacheKeyPrefix}:requestContext`)
      : null;

    for (const [i, item] of items.entries()) {
      let hasError = false;

      // Validate input if schema enabled
      if (inputValidator) {
        const inputResult = inputValidator.safeParse(item.input);
        if (!inputResult.success) {
          result.invalid.push({
            index: i,
            data: item,
            field: 'input',
            errors: this.formatErrors(inputResult.error),
          });
          hasError = true;
          if (result.invalid.length >= maxErrors) break;
        }
      }

      // Validate groundTruth if schema enabled and value provided
      if (!hasError && outputValidator && item.groundTruth !== undefined) {
        const outputResult = outputValidator.safeParse(item.groundTruth);
        if (!outputResult.success) {
          result.invalid.push({
            index: i,
            data: item,
            field: 'groundTruth',
            errors: this.formatErrors(outputResult.error),
          });
          hasError = true;
          if (result.invalid.length >= maxErrors) break;
        }
      }

      // Validate requestContext if schema enabled and value provided
      if (!hasError && requestContextValidator && item.requestContext !== undefined) {
        const rcResult = requestContextValidator.safeParse(item.requestContext);
        if (!rcResult.success) {
          result.invalid.push({
            index: i,
            data: item,
            field: 'requestContext',
            errors: this.formatErrors(rcResult.error),
          });
          hasError = true;
          if (result.invalid.length >= maxErrors) break;
        }
      }

      if (!hasError) {
        result.valid.push({ index: i, data: item });
      }
    }

    return result;
  }

  /** Format Zod errors to FieldError array */
  private formatErrors(error: ZodError): FieldError[] {
    return error.issues.slice(0, 5).map((issue: ZodIssue) => ({
      // Convert Zod path array to JSON Pointer string
      path: issue.path.length > 0 ? '/' + issue.path.join('/') : '/',
      code: issue.code,
      message: issue.message,
    }));
  }
}

/** Singleton validator instance */
let validatorInstance: SchemaValidator | null = null;

/** Get or create validator instance */
export function getSchemaValidator(): SchemaValidator {
  if (!validatorInstance) {
    validatorInstance = new SchemaValidator();
  }
  return validatorInstance;
}

/** Create new validator (for testing) */
export function createValidator(): SchemaValidator {
  return new SchemaValidator();
}
