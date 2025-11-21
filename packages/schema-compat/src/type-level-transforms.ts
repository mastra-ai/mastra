/**
 * Type-level transformations that mirror runtime schema transformations.
 *
 * These types accurately represent what the runtime transformation does:
 * - Every .optional() becomes .nullable()
 * - Any .nullable().optional() or .optional().nullable() collapses to just .nullable()
 * - Objects, arrays, unions, and effects are recursively walked
 *
 * This ensures TypeScript autocomplete and z.infer<> reflect the actual transformed schema.
 */

import type { z } from 'zod';

type AnyZod = z.ZodTypeAny;

/**
 * Helper to strip a single outer Optional wrapper
 */
type StripOptional<T extends AnyZod> = T extends z.ZodOptional<infer Inner> ? Inner : T;

/**
 * Helper to strip a single outer Nullable wrapper
 */
type StripNullable<T extends AnyZod> = T extends z.ZodNullable<infer Inner> ? Inner : T;

/**
 * Generic schema transformation that converts .optional() to .nullable()
 * This mirrors the runtime transformation used by provider compat layers.
 *
 * The transformation rules:
 * 1. ZodOptional<T> → ZodNullable<ProcessedSchema<T>> (strip optional wrapper, process inner, wrap with nullable)
 * 2. ZodNullable<T> → ZodNullable<ProcessedSchema<T>> (strip nullable wrapper, process inner, re-wrap)
 * 3. Objects → Recursively process all properties
 * 4. Arrays → Recursively process element type
 * 5. Unions → Recursively process all options
 * 6. Effects → Recursively process inner type
 * 7. Everything else → Pass through unchanged
 *
 * This type is used by all provider compat layers (OpenAI, Anthropic, Google, etc.)
 * that need to convert optional fields to nullable for strict schema validation.
 */
export type ProcessedSchema<T extends AnyZod> =
  // 1. T is Optional<Inner>
  T extends z.ZodOptional<infer Inner>
    ? // Strip any nested nullable, process the core type, then wrap in nullable
      StripNullable<Inner> extends infer InnerNoNull
      ? InnerNoNull extends AnyZod
        ? z.ZodNullable<ProcessedSchema<InnerNoNull>>
        : never
      : never
    : // 2. T is Nullable<Inner>
      T extends z.ZodNullable<infer Inner>
      ? // Strip any nested optional, process the core type, then wrap in nullable
        StripOptional<Inner> extends infer InnerNoOpt
        ? InnerNoOpt extends AnyZod
          ? z.ZodNullable<ProcessedSchema<InnerNoOpt>>
          : never
        : never
      : // 3. Objects: recurse into shape
        T extends z.ZodObject<infer Shape, infer UnknownKeys, infer Catchall>
        ? z.ZodObject<{ [K in keyof Shape]: ProcessedSchema<Shape[K]> }, UnknownKeys, Catchall>
        : // 4. Arrays: recurse into element
          T extends z.ZodArray<infer Elem, infer Card>
          ? z.ZodArray<ProcessedSchema<Elem>, Card>
          : // 5. Unions: recurse into each option
            T extends z.ZodUnion<infer Options>
            ? z.ZodUnion<{ [I in keyof Options]: ProcessedSchema<Options[I]> }>
            : // 6. Effects (transforms, refinements, etc.): recurse into inner
              T extends z.ZodEffects<infer Inner, infer Out, infer In>
              ? z.ZodEffects<ProcessedSchema<Inner>, Out, In>
              : // 7. Default (ZodDefault): recurse into inner type
                T extends z.ZodDefault<infer Inner>
                ? ProcessedSchema<Inner>
                : // 8. All other types pass through unchanged (strings, numbers, dates, etc.)
                  T;

/**
 * Alias for OpenAI-specific schema processing.
 * Uses the generic ProcessedSchema type.
 */
export type OpenAIProcessed<T extends AnyZod> = ProcessedSchema<T>;
