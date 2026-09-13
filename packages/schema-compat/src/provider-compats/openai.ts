import type { JSONSchema7, JSONSchema7Type } from 'json-schema';
import { z } from 'zod';
import type { ZodType as ZodTypeV3, ZodObject as ZodObjectV3 } from 'zod/v3';
import type { ZodType as ZodTypeV4, ZodObject as ZodObjectV4 } from 'zod/v4';
import type { Targets } from 'zod-to-json-schema';
import type { Schema } from '../json-schema';
import { jsonSchema } from '../json-schema';
import {
  isAllOfSchema,
  isArraySchema,
  isNumberSchema,
  isObjectSchema,
  isStringSchema,
  isUnionSchema,
} from '../json-schema/utils';
import { SchemaCompatLayer } from '../schema-compatibility';
import type { PublicSchema, ZodType } from '../schema.types';
import { standardSchemaToJSONSchema, toStandardSchema } from '../standard-schema/standard-schema';
import type { StandardSchemaWithJSON } from '../standard-schema/standard-schema.types';
import { isOptional, isObj, isUnion, isArr, isString, isNullable, isDefault, isIntersection } from '../zodTypes';

// @see https://developers.openai.com/api/docs/guides/structured-outputs#supported-schemas
const allowedStringFormats = [
  'date-time',
  'time',
  'date',
  'duration',
  'email',
  'hostname',
  'ipv4',
  'ipv6',
  'uuid',
] as const;

function unorderedArraysEqual(
  left: unknown[],
  right: unknown[],
  itemEquals: (leftItem: unknown, rightItem: unknown) => boolean,
): boolean {
  if (left.length !== right.length) return false;

  const matched = new Set<number>();
  return left.every(leftItem => {
    const matchIndex = right.findIndex((rightItem, index) => !matched.has(index) && itemEquals(leftItem, rightItem));
    if (matchIndex === -1) return false;
    matched.add(matchIndex);
    return true;
  });
}

function jsonValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => jsonValuesEqual(value, right[index]))
    );
  }
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;

  const leftEntries = Object.entries(left);
  const rightRecord = right as Record<string, unknown>;
  return (
    leftEntries.length === Object.keys(rightRecord).length &&
    leftEntries.every(
      ([key, value]) =>
        Object.prototype.hasOwnProperty.call(rightRecord, key) && jsonValuesEqual(value, rightRecord[key]),
    )
  );
}

function schemaValuesEqual(left: unknown, right: unknown, keyword?: string): boolean {
  if (keyword === 'const' || keyword === 'default' || keyword === 'example' || keyword === 'examples') {
    return jsonValuesEqual(left, right);
  }
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (keyword === 'required' || keyword === 'type') {
      return unorderedArraysEqual(left, right, Object.is);
    }
    if (keyword === 'enum') {
      return unorderedArraysEqual(left, right, jsonValuesEqual);
    }
    if (keyword === 'allOf' || keyword === 'anyOf' || keyword === 'oneOf') {
      return unorderedArraysEqual(left, right, (leftItem, rightItem) => schemaValuesEqual(leftItem, rightItem));
    }
    return left.length === right.length && left.every((value, index) => schemaValuesEqual(value, right[index]));
  }
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;

  const leftEntries = Object.entries(left);
  const rightRecord = right as Record<string, unknown>;
  return (
    leftEntries.length === Object.keys(rightRecord).length &&
    leftEntries.every(
      ([key, value]) =>
        Object.prototype.hasOwnProperty.call(rightRecord, key) && schemaValuesEqual(value, rightRecord[key], key),
    )
  );
}

function scalarTypeForValue(value: unknown): JSONSchema7['type'] | undefined {
  if (typeof value === 'string') return 'string';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  return undefined;
}

function inferScalarType(schema: JSONSchema7): JSONSchema7['type'] | undefined {
  const values = 'const' in schema ? [schema.const] : Array.isArray(schema.enum) ? schema.enum : [];
  const inferredTypes = values.map(scalarTypeForValue);
  if (inferredTypes.some(type => type === undefined)) return undefined;

  const types = [...new Set(inferredTypes)] as string[];
  if (types.length === 0) return undefined;
  return types.length === 1 ? (types[0] as JSONSchema7['type']) : (types as JSONSchema7['type']);
}

export class OpenAISchemaCompatLayer extends SchemaCompatLayer {
  getSchemaTarget(): Targets | undefined {
    return `jsonSchema7`;
  }

  isReasoningModel(): boolean {
    // there isn't a good way to automatically detect reasoning models besides doing this.
    // in the future when o5 is released this compat wont apply and we'll want to come back and update this class + our tests
    const modelId = this.getModel().modelId;
    if (!modelId) return false;
    return modelId.includes(`o3`) || modelId.includes(`o4`) || modelId.includes(`o1`);
  }

  shouldApply(): boolean {
    const model = this.getModel();
    if (
      !this.isReasoningModel() &&
      (model.provider.includes(`openai`) || model.modelId?.includes(`openai`) || model.provider.includes(`groq`))
    ) {
      return true;
    }

    return false;
  }

  processZodType(value: ZodType): ZodType {
    if (isOptional(z)(value)) {
      // For OpenAI strict mode, convert .optional() to .nullable() with transform
      // This ensures all fields are in the required array but can accept null values
      // The transform converts null -> undefined to match original .optional() semantics
      const innerType = '_def' in value ? value._def.innerType : (value as any)._zod?.def?.innerType;

      if (innerType) {
        // If inner is nullable, just process and return it with transform (strips the optional wrapper)
        // This converts .optional().nullable() -> .nullable() with transform
        if (isNullable(z)(innerType)) {
          const processed = this.processZodType(innerType);
          return processed.transform((val: any) => (val === null ? undefined : val));
        }

        // Otherwise, process inner, make it nullable, and add transform
        // This converts .optional() -> .nullable() with transform that converts null to undefined
        const processedInner = this.processZodType(innerType);
        return processedInner.nullable().transform((val: any) => (val === null ? undefined : val));
      }

      return value;
    } else if (isNullable(z)(value)) {
      // Process nullable: unwrap, process inner, and re-wrap with nullable
      const innerType = '_def' in value ? value._def.innerType : (value as any)._zod?.def?.innerType;
      if (innerType) {
        // Special case: if inner is optional, strip it and add transform for OpenAI strict mode
        // This converts .nullable().optional() -> .nullable() with transform
        if (isOptional(z)(innerType)) {
          const innerInnerType =
            '_def' in innerType ? innerType._def.innerType : (innerType as any)._zod?.def?.innerType;
          if (innerInnerType) {
            const processedInnerInner = this.processZodType(innerInnerType);
            return processedInnerInner.nullable().transform((val: any) => (val === null ? undefined : val));
          }
        }

        const processedInner = this.processZodType(innerType);
        return processedInner.nullable();
      }
      return value;
    } else if (isDefault(z)(value)) {
      // For OpenAI strict mode, convert .default() to .nullable() with transform
      // This ensures all fields are in the required array but can accept null values
      // The transform converts null -> default value to match original .default() semantics
      const innerType = '_def' in value ? value._def.innerType : (value as any)._zod?.def?.innerType;
      const defaultValue = '_def' in value ? value._def.defaultValue : (value as any)._zod?.def?.defaultValue;

      if (innerType) {
        const processedInner = this.processZodType(innerType);
        // Transform null -> default value (call defaultValue() if it's a function)
        return processedInner.nullable().transform((val: any) => {
          if (val === null) {
            return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
          }
          return val;
        });
      }

      return value;
    } else if (isObj(z)(value)) {
      return this.defaultZodObjectHandler(value);
    } else if (isUnion(z)(value)) {
      return this.defaultZodUnionHandler(value);
    } else if (isArr(z)(value)) {
      return this.defaultZodArrayHandler(value);
    } else if (isString(z)(value)) {
      const model = this.getModel();
      const checks = ['emoji'] as const;

      if (model.modelId?.includes('gpt-4o-mini')) {
        return this.defaultZodStringHandler(value, ['emoji', 'regex']);
      }

      return this.defaultZodStringHandler(value, checks);
    }

    if (isIntersection(z)(value)) {
      return this.defaultZodIntersectionHandler(value);
    }

    return this.defaultUnsupportedZodTypeHandler(value as ZodObjectV4<any> | ZodObjectV3<any>, [
      'ZodNever',
      'ZodUndefined',
      'ZodTuple',
    ]);
  }

  /**
   * Override to apply the same JSON Schema fixes (additionalProperties, required fields)
   * that processToJSONSchema applies. The base implementation skips JSON Schema traversal,
   * which causes OpenAI strict mode to reject tool schemas missing additionalProperties: false.
   */
  processToAISDKSchema(zodSchema: ZodTypeV3 | ZodTypeV4): Schema {
    const compat = this.processToCompatSchema(zodSchema);

    // Apply the same JSON Schema fixes as processToJSONSchema
    const transformedJsonSchema = standardSchemaToJSONSchema(compat);

    // Post-process the raw LLM value: strip falsy optional fields and convert
    // date strings back to Date objects, then validate against the original Zod schema.
    return jsonSchema(transformedJsonSchema, {
      validate: (value: unknown) => {
        const transformed = this.#traverse(value, transformedJsonSchema as Record<string, unknown>);
        const result = zodSchema.safeParse(transformed);
        return result.success ? { success: true, value: result.data } : { success: false, error: result.error };
      },
    });
  }

  public processToCompatSchema<T>(schema: PublicSchema<T>): StandardSchemaWithJSON<T> {
    const originalStandardSchema = toStandardSchema(schema);

    return {
      '~standard': {
        version: 1,
        vendor: 'mastra',
        validate: (value: unknown) => {
          const transformedJsonSchema = this.processToJSONSchema(schema, 'input') as Record<string, unknown>;
          // Apply OpenAI-specific transforms: null→undefined for optional fields, date string→Date
          const transformed = this.#traverse(value, transformedJsonSchema as Record<string, unknown>);

          // Then validate against the original schema
          return originalStandardSchema['~standard'].validate(transformed);
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

  preProcessJSONNode(schema: JSONSchema7, _parentSchema?: JSONSchema7): void {
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
      if (schema.format) {
        if (!(allowedStringFormats as readonly string[]).includes(schema.format as string)) {
          delete schema.format;
          delete schema.pattern;
        }
      }

      this.defaultStringHandler(schema);
    }
  }

  postProcessJSONNode(schema: JSONSchema7): void {
    // Handle union schemas in post-processing (after children are processed)
    if (isUnionSchema(schema)) {
      this.defaultUnionHandler(schema);
    }

    if (Array.isArray(schema.anyOf)) {
      for (const branch of schema.anyOf) {
        if (typeof branch === 'object' && branch !== null && branch.type === undefined) {
          const inferredType = inferScalarType(branch);
          if (inferredType) {
            branch.type = inferredType;
          }
        }
      }
    }

    if (schema.type === undefined && !schema.anyOf) {
      const inferredType = inferScalarType(schema);
      if (inferredType) {
        schema.type = inferredType;
      }

      if (schema.type !== undefined) {
        return;
      }

      let subSchema: typeof schema = {};
      for (const key of Object.keys(schema)) {
        // @ts-expect-error - key is a valid property for JSON Schema
        subSchema[key] = schema[key];
        // @ts-expect-error - key is a valid property for JSON Schema
        delete schema[key];
      }

      schema.anyOf = [
        subSchema,
        {
          type: 'null',
        },
      ];
    }

    // Ensure bare {"type":"object"} nodes (e.g., inside anyOf) have additionalProperties: false.
    // OpenAI strict mode requires this on every object-type node, even without properties.
    if (isObjectSchema(schema)) {
      schema.additionalProperties = false;

      // OpenAI strict mode rejects `propertyNames`, which z.record() emits for its key type.
      delete schema.propertyNames;

      if (schema.properties) {
        for (const key of Object.keys(schema.properties)) {
          const prop = schema.properties[key] as JSONSchema7;

          if (!schema.required) {
            schema.required = [];
          }

          if (!schema.required?.includes(key)) {
            // @ts-expect-error - x-optional is a custom property
            schema['x-optional'] = [...(schema['x-optional'] || []), key];
            schema.required?.push(key);
            const objectKeywords = ['properties', 'required', 'additionalProperties', 'x-optional'] as const;
            const arrayKeywords = ['items'] as const;
            const genericConstraintKeywords = ['const', 'enum', 'oneOf', 'not', 'if', 'then', 'else'] as const;
            const branchConstraintKeywords = ['anyOf', 'oneOf', 'not', 'if', 'then', 'else'] as const;
            const typeSpecificKeywords = (type: JSONSchema7['type']) =>
              type === 'object' ? objectKeywords : type === 'array' ? arrayKeywords : [];
            const isRedundantNullableUnion = (type: JSONSchema7['type']) => {
              if (!prop.anyOf || prop.anyOf.length !== 2) return false;

              const nullBranches = prop.anyOf.filter(branch => typeof branch !== 'boolean' && branch.type === 'null');
              const valueBranches = prop.anyOf.filter(branch => typeof branch !== 'boolean' && branch.type !== 'null');
              if (nullBranches.length !== 1 || valueBranches.length !== 1) return false;

              const valueBranch = valueBranches[0] as JSONSchema7;
              if (valueBranch.type !== type) return false;

              return Object.entries(valueBranch).every(([keyword, value]) => {
                if (keyword === 'type') return true;
                return keyword in prop && schemaValuesEqual((prop as Record<string, unknown>)[keyword], value, keyword);
              });
            };

            if (Array.isArray(prop.type)) {
              const types = [...prop.type];
              if (!types.includes('null')) {
                types.push('null');
              }

              const branchConstraints = {} as JSONSchema7;
              const propRecord = prop as Record<string, unknown>;
              const branchConstraintRecord = branchConstraints as Record<string, unknown>;
              for (const keyword of branchConstraintKeywords) {
                if (keyword in prop) {
                  branchConstraintRecord[keyword] = propRecord[keyword];
                  delete propRecord[keyword];
                }
              }
              delete prop.type;

              if ('const' in prop) {
                const constValue = prop.const as JSONSchema7Type;
                const enumAllowsConst = !prop.enum || prop.enum.some(value => jsonValuesEqual(value, constValue));
                prop.enum = enumAllowsConst ? [constValue, null] : [null];
                delete prop.const;
              } else if (prop.enum && !prop.enum.includes(null)) {
                prop.enum = [...prop.enum, null];
              }

              prop.anyOf = types.map(type => {
                if (type === 'null') {
                  return { type: 'null' } as JSONSchema7;
                }

                const branch = { type } as JSONSchema7;
                for (const keyword of typeSpecificKeywords(type)) {
                  if (keyword in prop) {
                    // @ts-expect-error - keyword is a valid property for JSON Schema
                    branch[keyword] = prop[keyword];
                  }
                }

                return Object.assign(branch, branchConstraints);
              });

              for (const keyword of [...objectKeywords, ...arrayKeywords]) {
                // @ts-expect-error - keyword is a valid property for JSON Schema
                delete prop[keyword];
              }
            } else if (prop.type && prop.type !== 'null') {
              const originalType = prop.type;
              const keywords = typeSpecificKeywords(originalType);
              if (keywords.length > 0) {
                const branch = { type: originalType } as JSONSchema7;
                const preserveAnyOf = prop.anyOf && !isRedundantNullableUnion(originalType) ? prop.anyOf : undefined;
                for (const keyword of [...keywords, ...genericConstraintKeywords]) {
                  if (keyword in prop) {
                    // @ts-expect-error - keyword is a valid property for JSON Schema
                    branch[keyword] = prop[keyword];
                    // @ts-expect-error - keyword is a valid property for JSON Schema
                    delete prop[keyword];
                  }
                }
                if (preserveAnyOf) {
                  branch.anyOf = preserveAnyOf;
                }

                delete prop.type;
                prop.anyOf = [branch, { type: 'null' }];
              } else {
                const propSchema = { ...prop, type: originalType } as JSONSchema7;
                if (isRedundantNullableUnion(originalType)) {
                  delete propSchema.anyOf;
                }
                for (const keyword of [...genericConstraintKeywords, 'anyOf'] as const) {
                  delete prop[keyword];
                }
                delete prop.type;
                prop.anyOf = [propSchema, { type: 'null' }];
              }
            }
          }
        }
      }
    }
  }

  #traverse(value: unknown, schema: Record<string, unknown>): unknown {
    // If schema uses anyOf, find the variant matching the value for traversal
    const resolved = this.#resolveAnyOf(schema, value);

    if ((isDateFormat(resolved) || resolved['x-date'] === true) && typeof value === 'string') {
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
    const optionalProperties = (resolved['x-optional'] ?? []) as string[];
    for (const key in obj) {
      if (optionalProperties.includes(key) && obj[key] === null) {
        obj[key] = undefined;
      } else if (properties[key]) {
        obj[key] = this.#traverse(obj[key], properties[key]);
      }
    }

    return obj;
  }

  /**
   * If schema has anyOf, return the variant whose type matches the value's shape
   * (branches are type-specific), falling back to the first non-null variant.
   * Otherwise return the schema itself.
   */
  #resolveAnyOf(schema: Record<string, unknown>, value?: unknown): Record<string, unknown> {
    if (Array.isArray(schema.anyOf)) {
      const nonNullVariants = (schema.anyOf as Record<string, unknown>[]).filter(s => s && s.type !== 'null');

      const valueType = Array.isArray(value)
        ? 'array'
        : value !== null && typeof value === 'object'
          ? 'object'
          : typeof value === 'number'
            ? Number.isInteger(value)
              ? 'integer'
              : 'number'
            : typeof value === 'string' || typeof value === 'boolean'
              ? typeof value
              : undefined;
      if (valueType) {
        const hasType = (variant: Record<string, unknown>, type: string) =>
          (Array.isArray(variant.type) ? (variant.type as string[]) : [variant.type]).includes(type);
        const exactMatch = nonNullVariants.find(variant => hasType(variant, valueType));
        if (exactMatch) {
          return { ...schema, ...exactMatch };
        }
        if (valueType === 'integer') {
          const numberMatch = nonNullVariants.find(variant => hasType(variant, 'number'));
          if (numberMatch) {
            return { ...schema, ...numberMatch };
          }
        }
      }

      if (nonNullVariants[0]) {
        return { ...schema, ...nonNullVariants[0] };
      }
    }

    return schema;
  }
}

function isDateFormat(schema: Record<string, unknown>): boolean {
  return schema.format === 'date-time' || schema.format === 'date';
}
