import { TypeValidationError } from '@ai-sdk/provider-v5';
import type { Schema } from 'ai-v5';

export type ValidationResult<T> =
  | {
      success: true;
      value: T;
    }
  | {
      success: false;
      error: Error;
    };

/**
 * Safely validates the types of an unknown object using a schema.
 * Based on @ai-sdk/provider-utils safeValidateTypes
 */
export async function safeValidateTypes<OBJECT>({
  value,
  schema,
}: {
  value: unknown;
  schema: Schema<OBJECT>;
}): Promise<ValidationResult<OBJECT>> {
  try {
    // Check if validate method exists (it's optional on Schema)
    if (!schema.validate) {
      // If no validate method, we can't validate - just pass through
      return {
        success: true,
        value: value as OBJECT,
      };
    }

    const result = await schema.validate(value);

    if (!result.success) {
      return {
        success: false,
        error: new TypeValidationError({
          value,
          cause: 'Validation failed',
        }),
      };
    }

    return {
      success: true,
      value: result.value,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
