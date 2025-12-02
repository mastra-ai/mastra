import type { Schema } from 'ai-v5';
export type ValidationResult<T> = {
    success: true;
    value: T;
} | {
    success: false;
    error: Error;
};
/**
 * Safely validates the types of an unknown object using a schema.
 * Based on @ai-sdk/provider-utils safeValidateTypes
 */
export declare function safeValidateTypes<OBJECT>({ value, schema, }: {
    value: unknown;
    schema: Schema<OBJECT>;
}): Promise<ValidationResult<OBJECT>>;
//# sourceMappingURL=validation.d.ts.map