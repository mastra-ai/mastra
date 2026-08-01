import type { JSONSchema7 } from 'json-schema';
import { z } from 'zod';
import type { ZodType as ZodTypeV3 } from 'zod/v3';
import type { ZodType as ZodTypeV4 } from 'zod/v4';
import type { Targets } from 'zod-to-json-schema';

import { jsonSchema } from '../json-schema';
import {
  isAllOfSchema,
  isArraySchema,
  isObjectSchema,
  isNumberSchema,
  isStringSchema,
  isUnionSchema,
} from '../json-schema/utils';
import { SchemaCompatLayer } from '../schema-compatibility';
import type { PublicSchema, ZodType } from '../schema.types';
import { standardSchemaToJSONSchema, toStandardSchema } from '../standard-schema/standard-schema';
import type { StandardSchemaWithJSON } from '../standard-schema/standard-schema.types';
import type { ModelInformation } from '../types';
import { isZodType } from '../utils';
import { isIntersection, isNull, isNullable, isOptional } from '../zodTypes';

export class AnthropicSchemaCompatLayer extends SchemaCompatLayer {
  constructor(model: ModelInformation) {
    super(model);
  }

  getSchemaTarget(): Targets | undefined {
    return 'jsonSchema7';
  }

  shouldApply(): boolean {
    return this.getModel().modelId.includes('claude');
  }

  processZodType(value: ZodType): ZodType {
    if (this.isOptional(value)) {
      const handleTypes: string[] = ['ZodObject', 'ZodArray', 'ZodUnion', 'ZodNever', 'ZodUndefined', 'ZodTuple'];
      if (this.getModel().modelId.includes('claude-3.5-haiku')) handleTypes.push('ZodString');
      return this.defaultZodOptionalHandler(value, handleTypes);
    } else if (this.isObj(value)) {
      return this.defaultZodObjectHandler(value);
    } else if (this.isArr(value)) {
      return this.defaultZodArrayHandler(value, []);
    } else if (this.isUnion(value)) {
      return this.defaultZodUnionHandler(value);
    } else if (this.isString(value)) {
      // the claude-3.5-haiku model support these properties but the model doesn't respect them, but it respects them when they're
      // added to the tool description

      if (this.getModel().modelId.includes('claude-3.5-haiku')) {
        return this.defaultZodStringHandler(value, ['max', 'min']);
      } else {
        return value;
      }
    } else if (isNull(z)(value)) {
      return z
        .any()
        .refine(v => v === null, { message: 'must be null' })
        .describe(value.description || 'must be null');
    } else if (isIntersection(z)(value)) {
      return this.defaultZodIntersectionHandler(value);
    }

    return this.defaultUnsupportedZodTypeHandler(value);
  }

  processToAISDKSchema(zodSchema: ZodTypeV3 | ZodTypeV4) {
    const compat = this.processToCompatSchema(zodSchema);
    const transformedJsonSchema = standardSchemaToJSONSchema(compat);

    return jsonSchema(transformedJsonSchema, {
      validate: (value: unknown) => {
        const result = compat['~standard'].validate(value);
        if (result instanceof Promise) {
          throw new Error('Async validation is not supported');
        }
        return 'issues' in result && result.issues
          ? { success: false as const, error: new Error(result.issues.map(i => i.message).join(', ')) }
          : { success: true as const, value: (result as { value: unknown }).value };
      },
    });
  }

  public processToCompatSchema<T>(schema: PublicSchema<T>): StandardSchemaWithJSON<T> {
    const originalStandardSchema = toStandardSchema(schema);
    const validationStandardSchema = this.#getCompatValidationStandardSchema(schema, originalStandardSchema);

    return {
      '~standard': {
        version: 1,
        vendor: 'mastra',
        validate: (value: unknown) => {
          const transformedJsonSchema = this.processToJSONSchema(schema, 'input') as Record<string, unknown>;
          const transformed = this.#traverse(value, transformedJsonSchema);
          return validationStandardSchema['~standard'].validate(transformed);
        },
        jsonSchema: {
          input: () => {
            return this.processToJSONSchema(schema, 'input') as Record<string, unknown>;
          },
          output: () => {
            return this.processToJSONSchema(schema, 'output') as Record<string, unknown>;
          },
        },
      },
    };
  }

  preProcessJSONNode(schema: JSONSchema7): void {
    if (isAllOfSchema(schema)) {
      this.defaultAllOfHandler(schema);
    }

    if (isObjectSchema(schema)) {
      this.defaultObjectHandler(schema);
    } else if (isArraySchema(schema)) {
      this.defaultArrayHandler(schema);
    } else if (isNumberSchema(schema)) {
      this.defaultNumberHandler(schema);
    } else if (isStringSchema(schema)) {
      this.defaultStringHandler(schema);
    }
  }

  postProcessJSONNode(schema: JSONSchema7): void {
    // Handle union schemas in post-processing (after children are processed)
    if (isUnionSchema(schema)) {
      this.defaultUnionHandler(schema);
    }
  }

  #traverse(value: unknown, schema: Record<string, unknown>): unknown {
    const resolved = this.#resolveSchemaForValue(schema, value);

    if (resolved['x-date'] === true && typeof value === 'string') {
      return new Date(value);
    }

    const isArrayType =
      resolved.type === 'array' || (Array.isArray(resolved.type) && (resolved.type as string[]).includes('array'));
    if (isArrayType) {
      if (!Array.isArray(value)) {
        return value;
      }
      return value.map(item => this.#traverse(item, resolved.items as Record<string, unknown>));
    }

    const isObjectType =
      resolved.type === 'object' || (Array.isArray(resolved.type) && (resolved.type as string[]).includes('object'));
    if (!isObjectType) {
      return value;
    }

    const properties = resolved.properties as Record<string, Record<string, unknown>> | undefined;
    if (!properties || !value) {
      return value;
    }

    const obj = value as Record<string, unknown>;
    for (const key in obj) {
      if (properties[key]) {
        obj[key] = this.#traverse(obj[key], properties[key]);
      }
    }

    return obj;
  }

  // #resolveAnyOf(schema: Record<string, unknown>): Record<string, unknown> {
  //   if (Array.isArray(schema.anyOf)) {
  //     const nonNull = (schema.anyOf as Record<string, unknown>[]).find(s => s.type !== 'null');
  //     if (nonNull) {
  //       return nonNull;
  //     }
  //   }

  //   return schema;
  // }

  #isHaikuModel(): boolean {
    return this.getModel().modelId.includes('claude-3.5-haiku');
  }

  #getCompatValidationStandardSchema<T>(
    schema: PublicSchema<T>,
    originalStandardSchema: StandardSchemaWithJSON<T>,
  ): StandardSchemaWithJSON<T> {
    if (!this.#isHaikuModel() || !isZodType(schema)) {
      return originalStandardSchema;
    }

    return toStandardSchema(this.#stripHaikuStringLengthConstraints(schema as ZodType)) as StandardSchemaWithJSON<T>;
  }

  /**
   * Strip Haiku-ignored string min/max from a Zod schema for execute-time validation.
   * Preserves object-level refinements and wrapper semantics unlike full-tree processZodType.
   */
  #stripHaikuStringLengthConstraints(value: ZodType): ZodType {
    if ('_zod' in value) {
      return this.#stripHaikuStringLengthConstraintsV4(value);
    }

    return this.#stripHaikuStringLengthConstraintsV3(value);
  }

  #stripHaikuStringLengthConstraintsV4(value: ZodType): ZodType {
    const schema = value as any;

    if (this.isString(value)) {
      return this.defaultZodStringHandler(value, ['max', 'min']);
    }

    if (isOptional(z)(value)) {
      const innerType = schema._zod.def.innerType as ZodType;
      const stripped = this.#stripHaikuStringLengthConstraintsV4(innerType);
      return stripped === innerType ? value : stripped.optional();
    }

    if (isNullable(z)(value)) {
      const innerType = schema._zod.def.innerType as ZodType;
      const stripped = this.#stripHaikuStringLengthConstraintsV4(innerType);
      return stripped === innerType ? value : stripped.nullable();
    }

    if (schema.constructor.name === 'ZodDefault') {
      const innerType = schema._zod.def.innerType as ZodType;
      const stripped = this.#stripHaikuStringLengthConstraintsV4(innerType);
      if (stripped === innerType) {
        return value;
      }
      return stripped.default(schema._zod.def.defaultValue);
    }

    if (this.isArr(value)) {
      const element = schema._zod.def.element as ZodType;
      const stripped = this.#stripHaikuStringLengthConstraintsV4(element);
      return stripped === element ? value : z.array(stripped as any);
    }

    if (this.isUnion(value)) {
      const options = schema._zod.def.options as ZodType[];
      let changed = false;
      const strippedOptions = options.map(option => {
        const stripped = this.#stripHaikuStringLengthConstraintsV4(option);
        if (stripped !== option) {
          changed = true;
        }
        return stripped;
      });
      return changed ? z.union(strippedOptions as any) : value;
    }

    if (this.isObj(value)) {
      const shape = schema.shape as Record<string, ZodType>;
      let changed = false;
      const nextShape: Record<string, ZodType> = {};

      for (const key in shape) {
        const stripped = this.#stripHaikuStringLengthConstraintsV4(shape[key]!);
        nextShape[key] = stripped;
        if (stripped !== shape[key]) {
          changed = true;
        }
      }

      if (!changed) {
        return value;
      }

      let nextObject = z.object(nextShape as any);
      for (const check of schema._zod.def.checks ?? []) {
        nextObject = nextObject.check(check);
      }
      return nextObject;
    }

    return value;
  }

  #stripHaikuStringLengthConstraintsV3(value: ZodType): ZodType {
    const schema = value as any;
    const typeName = schema._def?.typeName;

    if (typeName === 'ZodString' && this.isString(value)) {
      return this.defaultZodStringHandler(value, ['max', 'min']);
    }

    if (typeName === 'ZodOptional') {
      const innerType = schema._def.innerType as ZodType;
      const stripped = this.#stripHaikuStringLengthConstraintsV3(innerType);
      return stripped === innerType ? value : stripped.optional();
    }

    if (typeName === 'ZodNullable') {
      const innerType = schema._def.innerType as ZodType;
      const stripped = this.#stripHaikuStringLengthConstraintsV3(innerType);
      return stripped === innerType ? value : stripped.nullable();
    }

    if (typeName === 'ZodDefault') {
      const innerType = schema._def.innerType as ZodType;
      const stripped = this.#stripHaikuStringLengthConstraintsV3(innerType);
      if (stripped === innerType) {
        return value;
      }
      return stripped.default(schema._def.defaultValue());
    }

    if (typeName === 'ZodArray') {
      const element = schema._def.type as ZodType;
      const stripped = this.#stripHaikuStringLengthConstraintsV3(element);
      return stripped === element ? value : z.array(stripped as any);
    }

    if (typeName === 'ZodUnion') {
      const options = schema._def.options as ZodType[];
      let changed = false;
      const strippedOptions = options.map(option => {
        const stripped = this.#stripHaikuStringLengthConstraintsV3(option);
        if (stripped !== option) {
          changed = true;
        }
        return stripped;
      });
      return changed ? z.union(strippedOptions as any) : value;
    }

    if (typeName === 'ZodObject' && this.isObj(value)) {
      const shape = schema.shape as Record<string, ZodType>;
      let changed = false;
      const nextShape: Record<string, ZodType> = {};

      for (const key in shape) {
        const stripped = this.#stripHaikuStringLengthConstraintsV3(shape[key]!);
        nextShape[key] = stripped;
        if (stripped !== shape[key]) {
          changed = true;
        }
      }

      return changed ? z.object(nextShape as any) : value;
    }

    if (typeName === 'ZodEffects') {
      const innerType = schema._def.schema as ZodType;
      const stripped = this.#stripHaikuStringLengthConstraintsV3(innerType);
      if (stripped === innerType) {
        return value;
      }

      const effect = schema._def.effect;
      if (effect.type === 'refinement') {
        return (stripped as any).refine(effect.refinement, {
          message: effect.message,
          path: effect.path,
        });
      }

      if (effect.type === 'transform') {
        return (stripped as any).transform(effect.transform);
      }

      return value;
    }

    return value;
  }

  #resolveSchemaForValue(schema: Record<string, unknown>, value: unknown): Record<string, unknown> {
    if (!Array.isArray(schema.anyOf)) {
      return schema;
    }

    const variants = schema.anyOf as Record<string, unknown>[];
    const nonNullVariants = variants.filter(variant => variant.type !== 'null');
    // fast-path only for nullable wrappers
    if (variants.length === 2 && nonNullVariants.length === 1) {
      return nonNullVariants[0]!;
    }
    // otherwise choose a branch from the runtime value, or recurse each branch
    const keys = value && typeof value === 'object' ? Object.keys(value as Record<string, unknown>) : [];
    return (
      nonNullVariants.find(variant => {
        const properties = variant.properties as Record<string, unknown> | undefined;
        return !!properties && keys.some(key => key in properties);
      }) ?? schema
    );
  }
}
