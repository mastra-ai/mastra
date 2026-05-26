import type { JSONSchema7 } from 'json-schema';
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
import type { PublicSchema } from '../schema.types';
import { standardSchemaToJSONSchema, toStandardSchema } from '../standard-schema/standard-schema';
import type { StandardSchemaWithJSON } from '../standard-schema/standard-schema.types';
import type { ModelInformation } from '../types';
import { isOptional, isNullable, isNull, isObj, isArr, isUnion, isString, isNumber, isIntersection } from '../zodTypes';

/**
 * `$ref` and `definitions` aren't part of OpenAPI 3.0's `Schema` Object — Google
 * rejects both. Zod emits them for recursive schemas (`z.lazy(...)`). We can't
 * truly inline a recursive ref (it loops), so the pragmatic shape is: expand the
 * outer ref one level, then collapse any further refs to the same definition into
 * opaque `{type: 'object'}` nodes. The outer shape stays informative; the model
 * just doesn't get to see the recursive depth.
 */
function inlineRefsAndDropDefinitions(root: Record<string, any>): Record<string, any> {
  if (!root || typeof root !== 'object') return root;
  const definitions = root.definitions as Record<string, any> | undefined;
  if (!definitions) return root;

  const refToKey = (ref: string): string | null => {
    const match = /^#\/definitions\/(.+)$/.exec(ref);
    return match ? match[1] : null;
  };

  const inline = (node: any, seen: Set<string>): any => {
    if (Array.isArray(node)) return node.map(child => inline(child, seen));
    if (!node || typeof node !== 'object') return node;

    if (typeof node.$ref === 'string') {
      const key = refToKey(node.$ref);
      if (!key || !definitions[key] || seen.has(key)) {
        return { type: 'object' };
      }
      return inline(definitions[key], new Set([...seen, key]));
    }

    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = inline(v, seen);
    }
    return out;
  };

  const inlined = inline(root, new Set());
  delete inlined.definitions;
  return inlined;
}

function fixAISDKNullableUnionTypes(schema: Record<string, any>): Record<string, any> {
  if (typeof schema !== 'object' || schema === null) {
    return schema;
  }

  const result = { ...schema };

  if (Array.isArray(result.type)) {
    const nonNullTypes = result.type.filter((t: string) => t !== 'null');
    if (nonNullTypes.length === 1) {
      result.type = nonNullTypes[0];
      result.nullable = true;
    } else {
      delete result.type;
      delete result.nullable;
    }
  }

  if (Array.isArray(result.enum) && result.enum.some((value: unknown) => typeof value !== 'string')) {
    delete result.enum;
  }

  if ('const' in result && typeof result.const !== 'string') {
    delete result.const;
  }

  if (result.anyOf && Array.isArray(result.anyOf)) {
    const nullSchema = result.anyOf.find((s: any) => typeof s === 'object' && s !== null && s.type === 'null');
    const nonNullSchemas = result.anyOf.filter((s: any) => !(typeof s === 'object' && s !== null && s.type === 'null'));

    if (nullSchema) {
      const { anyOf: _, ...rest } = result;
      if (nonNullSchemas.length === 1 && typeof nonNullSchemas[0] === 'object' && nonNullSchemas[0] !== null) {
        const fixedOther = fixAISDKNullableUnionTypes(nonNullSchemas[0]);
        return fixedOther.type ? { ...rest, ...fixedOther, nullable: true } : { ...rest, ...fixedOther };
      }
      return rest;
    }
  }

  if (result.properties && typeof result.properties === 'object') {
    result.properties = Object.fromEntries(
      Object.entries(result.properties).map(([key, value]) => [key, fixAISDKNullableUnionTypes(value as any)]),
    );
  }

  if (result.items) {
    if (Array.isArray(result.items)) {
      result.items = result.items.map((item: any) => fixAISDKNullableUnionTypes(item));
    } else {
      result.items = fixAISDKNullableUnionTypes(result.items);
    }
  }

  if (result.additionalProperties && typeof result.additionalProperties === 'object') {
    result.additionalProperties = fixAISDKNullableUnionTypes(result.additionalProperties);
  }

  if (result.anyOf && Array.isArray(result.anyOf)) {
    result.anyOf = result.anyOf.map((s: any) => fixAISDKNullableUnionTypes(s));
  }
  if (result.oneOf && Array.isArray(result.oneOf)) {
    result.oneOf = result.oneOf.map((s: any) => fixAISDKNullableUnionTypes(s));
  }
  if (result.allOf && Array.isArray(result.allOf)) {
    result.allOf = result.allOf.map((s: any) => fixAISDKNullableUnionTypes(s));
  }

  if (result.anyOf && Array.isArray(result.anyOf)) {
    if (result.description) {
      for (const item of result.anyOf) {
        if (typeof item === 'object' && item !== null && !item.description) {
          item.description = result.description;
        }
      }
    }
    return { anyOf: result.anyOf };
  }

  return result;
}

export class GoogleSchemaCompatLayer extends SchemaCompatLayer {
  constructor(model: ModelInformation) {
    super(model);
  }

  getSchemaTarget(): Targets | undefined {
    return 'jsonSchema7';
  }

  shouldApply(): boolean {
    return (
      this.getModel().provider.includes('google') ||
      this.getModel().modelId.includes('gemini-') ||
      this.getModel().modelId.includes('google')
    );
  }
  processZodType(value: ZodTypeV3): ZodTypeV3;
  processZodType(value: ZodTypeV4): ZodTypeV4;
  processZodType(value: ZodTypeV3 | ZodTypeV4): ZodTypeV3 | ZodTypeV4 {
    if (isOptional(z)(value)) {
      return this.defaultZodOptionalHandler(value, [
        'ZodObject',
        'ZodArray',
        'ZodUnion',
        'ZodString',
        'ZodNumber',
        'ZodNullable',
      ]);
    } else if (isNullable(z)(value)) {
      return this.defaultZodNullableHandler(value);
    } else if (isNull(z)(value)) {
      // Google models don't support null, so we need to convert it to any and then refine it to null
      return z
        .any()
        .refine(v => v === null, { message: 'must be null' })
        .describe(value.description || 'must be null');
    } else if (isObj(z)(value)) {
      return this.defaultZodObjectHandler(value);
    } else if (isArr(z)(value)) {
      return this.defaultZodArrayHandler(value, []);
    } else if (isUnion(z)(value)) {
      return this.defaultZodUnionHandler(value);
    } else if (isString(z)(value)) {
      // Google models support these properties but the model doesn't respect them, but it respects them when they're
      // added to the tool description
      return this.defaultZodStringHandler(value);
    } else if (isNumber(z)(value)) {
      // Google models support these properties but the model doesn't respect them, but it respects them when they're
      // added to the tool description
      return this.defaultZodNumberHandler(value);
    } else if (isIntersection(z)(value)) {
      return this.defaultZodIntersectionHandler(value);
    }
    return this.defaultUnsupportedZodTypeHandler(value as ZodObjectV4<any> | ZodObjectV3<any>);
  }

  public processToJSONSchema(schema: PublicSchema<any>, io?: 'input' | 'output'): JSONSchema7 {
    const out = super.processToJSONSchema(schema, io);
    const nullableFixed = fixAISDKNullableUnionTypes(out as Record<string, any>);
    return inlineRefsAndDropDefinitions(nullableFixed) as JSONSchema7;
  }

  processToAISDKSchema(zodSchema: ZodTypeV3 | ZodTypeV4): Schema {
    const compat = this.processToCompatSchema(zodSchema);
    const transformedJsonSchema = standardSchemaToJSONSchema(compat);
    const nullableFixed = fixAISDKNullableUnionTypes(transformedJsonSchema as Record<string, any>);
    const fixedJsonSchema = inlineRefsAndDropDefinitions(nullableFixed) as JSONSchema7;

    return jsonSchema(fixedJsonSchema, {
      validate: (value: unknown) => {
        const transformed = this.#traverse(value, fixedJsonSchema as Record<string, unknown>);
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
          const transformed = this.#traverse(value, transformedJsonSchema);
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

  preProcessJSONNode(schema: JSONSchema7): void {
    if (isAllOfSchema(schema)) {
      this.defaultAllOfHandler(schema);
    }

    if (isObjectSchema(schema)) {
      this.defaultObjectHandler(schema);
    } else if (isNumberSchema(schema)) {
      this.defaultNumberHandler(schema);
    } else if (isArraySchema(schema)) {
      this.defaultArrayHandler(schema);
    } else if (isStringSchema(schema)) {
      this.defaultStringHandler(schema);
    }
  }

  postProcessJSONNode(schema: JSONSchema7): void {
    // Handle union schemas in post-processing (after children are processed)
    if (isUnionSchema(schema)) {
      this.defaultUnionHandler(schema);
    }

    // OpenAPI 3.0 Schema Object has `anyOf` but no `oneOf`. Gemini's tool-calling
    // models can't read `oneOf` schemas correctly even though REST tolerates the
    // payload (issue #17057), and Live's setup validator rejects it outright.
    const node = schema as JSONSchema7 & { oneOf?: JSONSchema7[]; anyOf?: JSONSchema7[]; const?: unknown };
    if (Array.isArray(node.oneOf)) {
      node.anyOf = Array.isArray(node.anyOf) ? [...node.anyOf, ...node.oneOf] : node.oneOf;
      delete node.oneOf;
    }

    // OpenAPI 3.0 Schema Object has `enum` but no `const`.
    if (typeof node.const === 'string') {
      if (!Array.isArray(node.enum)) node.enum = [node.const];
      delete node.const;
    }

    // OpenAPI 3.0 Schema Object has no `additionalProperties` — neither the
    // OpenAI-strict-mode `false` form nor the `z.record` sub-schema form.
    if ('additionalProperties' in node) delete node.additionalProperties;

    // OpenAPI 3.0 Schema Object has no `propertyNames` either (emitted by Zod
    // record output for the string-key constraint).
    if ('propertyNames' in node) delete (node as any).propertyNames;

    // `$schema` is a JSON Schema dialect marker; OpenAPI 3.0 has no equivalent.
    if ('$schema' in node) delete (node as any).$schema;

    // OpenAPI 3.0 (and `@google/genai`'s `Schema` typedef) declares `items?: Schema`
    // (singular). The Draft-4 tuple form `items: [...]` makes Gemini REST return
    // `400 Unknown name "items" ... Proto field is not repeating, cannot start list`.
    // Collapse the per-position branches into a single `anyOf` (loses position info,
    // keeps type hints).
    const itemsHolder = node as JSONSchema7 & { items?: JSONSchema7 | JSONSchema7[] };
    if (Array.isArray(itemsHolder.items)) {
      const branches = itemsHolder.items.filter((s): s is JSONSchema7 => Boolean(s) && typeof s === 'object');
      itemsHolder.items = branches.length === 1 ? branches[0] : ({ anyOf: branches } as JSONSchema7);
    }
  }

  #traverse(value: unknown, schema: Record<string, unknown>): unknown {
    const resolved = this.#resolveAnyOf(schema);

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

  #resolveAnyOf(schema: Record<string, unknown>): Record<string, unknown> {
    if (Array.isArray(schema.anyOf)) {
      const nonNull = (schema.anyOf as Record<string, unknown>[]).find(s => s.type !== 'null');
      if (nonNull) {
        return nonNull;
      }
    }

    return schema;
  }
}
