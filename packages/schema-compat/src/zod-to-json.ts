import type { JSONSchema7 } from 'json-schema';
import type { ZodSchema as ZodSchemaV3 } from 'zod/v3';
import { z as zV4 } from 'zod/v4';
import type { Targets } from 'zod-to-json-schema';
import zodToJsonSchemaOriginal from 'zod-to-json-schema';

// Symbol to mark schemas as already patched (for idempotency)
const PATCHED = Symbol('__mastra_patched__');

/**
 * Recursively patch Zod v4 record schemas that are missing valueType.
 * This fixes a bug in Zod v4 where z.record(valueSchema) doesn't set def.valueType.
 * The single-arg form should set valueType but instead only sets keyType.
 *
 * Idempotent — marks patched schemas with a Symbol so repeat calls no-op.
 *
 * @internal Exported so the Zod v4 standard-schema adapter can apply the
 * same patch before its native `toJSONSchema` call (the legacy `zodToJsonSchema`
 * entry already calls it; the `applyCompatLayer` path otherwise wouldn't).
 * Not part of the public API.
 */
export function patchRecordSchemas(schema: any): any {
  if (!schema || typeof schema !== 'object') return schema;

  // Skip if already patched (idempotency check)
  if ((schema as any)[PATCHED]) return schema;
  (schema as any)[PATCHED] = true;

  // Check the _zod.def location (v4 structure)
  const def = schema._zod?.def;

  // Fix record schemas with missing valueType
  if (def?.type === 'record' && def.keyType && !def.valueType) {
    // The bug: z.record(valueSchema) puts the value in keyType instead of valueType
    // Fix: move it to valueType and set keyType to string (the default)
    def.valueType = def.keyType;
    def.keyType = zV4.string();
  }

  // Recursively patch nested schemas
  if (!def) return schema;

  if (def.type === 'object' && def.shape) {
    const shape = typeof def.shape === 'function' ? def.shape() : def.shape;
    for (const key of Object.keys(shape)) {
      patchRecordSchemas(shape[key]);
    }
  }

  if (def.type === 'array' && def.element) {
    patchRecordSchemas(def.element);
  }

  if (def.type === 'union' && def.options) {
    def.options.forEach(patchRecordSchemas);
  }

  if (def.type === 'record') {
    if (def.keyType) patchRecordSchemas(def.keyType);
    if (def.valueType) patchRecordSchemas(def.valueType);
  }

  // Handle intersection types
  if (def.type === 'intersection') {
    if (def.left) patchRecordSchemas(def.left);
    if (def.right) patchRecordSchemas(def.right);
  }

  // Handle lazy types - patch the schema returned by the getter
  if (def.type === 'lazy') {
    // For lazy schemas, we need to patch the schema when it's accessed
    // Store the original getter and wrap it
    if (def.getter && typeof def.getter === 'function') {
      const originalGetter = def.getter;
      def.getter = function () {
        const innerSchema = originalGetter();
        if (innerSchema) {
          patchRecordSchemas(innerSchema);
        }
        return innerSchema;
      };
    }
  }

  // Handle wrapper types that have innerType
  // This covers: optional, nullable, default, catch, nullish, and any other wrappers
  if (def.innerType) {
    patchRecordSchemas(def.innerType);
  }

  return schema;
}

/**
 * Recursively fixes anyOf patterns that some providers (like OpenAI) don't accept.
 * Converts anyOf: [{type: X}, {type: "null"}] to type: [X, "null"]
 * Also fixes empty {} property schemas by converting to a union of primitive types.
 */
function fixAnyOfNullable(schema: JSONSchema7): JSONSchema7 {
  if (typeof schema !== 'object' || schema === null) {
    return schema;
  }

  const result = { ...schema };

  // Fix anyOf pattern: [{type: X}, {type: "null"}] or [{type: "null"}, {type: X}]
  if (result.anyOf && Array.isArray(result.anyOf) && result.anyOf.length === 2) {
    const nullSchema = result.anyOf.find((s: any) => typeof s === 'object' && s !== null && s.type === 'null');
    const otherSchema = result.anyOf.find((s: any) => typeof s === 'object' && s !== null && s.type !== 'null');

    if (nullSchema && otherSchema && typeof otherSchema === 'object' && otherSchema.type) {
      // Convert anyOf to type array format
      // Normalize sibling fields (like properties/items) before returning
      const { anyOf, ...rest } = result;
      const fixedRest = fixAnyOfNullable(rest as JSONSchema7);
      const fixedOther = fixAnyOfNullable(otherSchema);
      return {
        ...fixedRest,
        ...fixedOther,
        type: (Array.isArray(fixedOther.type)
          ? [...fixedOther.type, 'null']
          : [fixedOther.type, 'null']) as JSONSchema7['type'],
      };
    }
  }

  // Fix empty property schemas {} - OpenAI requires a type key
  if (result.properties && typeof result.properties === 'object' && !Array.isArray(result.properties)) {
    result.properties = Object.fromEntries(
      Object.entries(result.properties).map(([key, value]) => {
        const propSchema = value as JSONSchema7;

        // If property is an empty object {}, convert to allow primitive types
        // Note: We exclude 'object' (requires additionalProperties) and 'array' (requires items) for OpenAI
        if (
          typeof propSchema === 'object' &&
          propSchema !== null &&
          !Array.isArray(propSchema) &&
          Object.keys(propSchema).length === 0
        ) {
          return [key, { type: ['string', 'number', 'boolean', 'null'] as JSONSchema7['type'] }];
        }

        // Recursively fix nested schemas
        return [key, fixAnyOfNullable(propSchema)];
      }),
    );
  }

  // Recursively fix items in arrays
  if (result.items) {
    if (Array.isArray(result.items)) {
      result.items = result.items.map(item => fixAnyOfNullable(item as JSONSchema7));
    } else {
      result.items = fixAnyOfNullable(result.items as JSONSchema7);
    }
  }

  // Recursively fix anyOf/oneOf/allOf schemas
  if (result.anyOf && Array.isArray(result.anyOf)) {
    result.anyOf = result.anyOf.map(s => fixAnyOfNullable(s as JSONSchema7));
  }
  if (result.oneOf && Array.isArray(result.oneOf)) {
    result.oneOf = result.oneOf.map(s => fixAnyOfNullable(s as JSONSchema7));
  }
  if (result.allOf && Array.isArray(result.allOf)) {
    result.allOf = result.allOf.map(s => fixAnyOfNullable(s as JSONSchema7));
  }

  return result;
}

/**
 * Apply a strict-mode pass to every schema hoisted into `$defs`/`definitions`.
 * zod-to-json-schema (v3 path, `$refStrategy: 'relative'`) lifts reused subschemas into
 * these definition maps and references them via `$ref`, so the referenced schemas must be
 * processed with the same pass as inline nodes or their unsupported keywords leak through.
 */
function applyToDefinitions(result: JSONSchema7, fn: (schema: JSONSchema7) => JSONSchema7): void {
  for (const defKey of ['$defs', 'definitions'] as const) {
    const defs = (result as Record<string, unknown>)[defKey];
    if (defs && typeof defs === 'object' && !Array.isArray(defs)) {
      (result as Record<string, unknown>)[defKey] = Object.fromEntries(
        Object.entries(defs as Record<string, unknown>).map(([key, value]) => [
          key,
          typeof value === 'object' && value !== null ? fn(value as JSONSchema7) : value,
        ]),
      );
    }
  }
}

/**
 * Recursively ensures all properties in an object schema are included in the `required` array.
 * OpenAI's strict structured output mode requires every key in `properties` to also appear in `required`.
 *
 * @param schema - The JSON Schema to process
 * @returns A new schema with all properties marked as required
 */
export function ensureAllPropertiesRequired(schema: JSONSchema7): JSONSchema7 {
  if (typeof schema !== 'object' || schema === null) {
    return schema;
  }

  const result = { ...schema };

  if (result.type === 'object' && result.properties) {
    result.required = Object.keys(result.properties);
    result.properties = Object.fromEntries(
      Object.entries(result.properties).map(([key, value]) => [key, ensureAllPropertiesRequired(value as JSONSchema7)]),
    );
  }

  if (result.items) {
    if (Array.isArray(result.items)) {
      result.items = result.items.map(item => ensureAllPropertiesRequired(item as JSONSchema7));
    } else if (typeof result.items === 'object') {
      result.items = ensureAllPropertiesRequired(result.items);
    }
  }

  if (result.additionalProperties && typeof result.additionalProperties === 'object') {
    result.additionalProperties = ensureAllPropertiesRequired(result.additionalProperties);
  }

  if (result.anyOf && Array.isArray(result.anyOf)) {
    result.anyOf = result.anyOf.map(s => ensureAllPropertiesRequired(s as JSONSchema7));
  }
  if (result.oneOf && Array.isArray(result.oneOf)) {
    result.oneOf = result.oneOf.map(s => ensureAllPropertiesRequired(s as JSONSchema7));
  }
  if (result.allOf && Array.isArray(result.allOf)) {
    result.allOf = result.allOf.map(s => ensureAllPropertiesRequired(s as JSONSchema7));
  }

  applyToDefinitions(result, ensureAllPropertiesRequired);

  return result;
}

/**
 * Prepare a JSON Schema for OpenAI strict mode by ensuring all object properties
 * are required and all objects have additionalProperties: false.
 */
export function prepareJsonSchemaForOpenAIStrictMode(schema: JSONSchema7): JSONSchema7 {
  const withRequired = ensureAllPropertiesRequired(schema);
  const withoutAdditional = ensureAdditionalPropertiesFalse(withRequired);
  return stripUnsupportedStrictModeKeywords(withoutAdditional);
}

// Keywords OpenAI Structured Outputs strict mode rejects and that carry no natural-language
// intent worth preserving. They are removed silently.
// @see https://platform.openai.com/docs/guides/structured-outputs#supported-schemas
const STRICT_MODE_DROPPED_KEYWORDS = [
  'contains',
  'minContains',
  'maxContains',
  'minProperties',
  'maxProperties',
  'patternProperties',
  'unevaluatedItems',
  'unevaluatedProperties',
  // Conditional/dependency keywords: unsupported by OpenAI strict mode with no
  // useful structural mapping, so they are dropped.
  'not',
  'if',
  'then',
  'else',
  'dependentRequired',
  'dependentSchemas',
] as const;

function isDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => isDeepEqual(v, b[i]));
  }
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  return (
    keysA.length === keysB.length &&
    keysA.every(
      k => Object.hasOwn(b, k) && isDeepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
    )
  );
}

/**
 * Merge `allOf` subschemas into the containing node. OpenAI strict mode rejects `allOf`
 * (only `anyOf` composition is supported), so the intersection is flattened into a single
 * node. Every keyword from every branch is hoisted so nothing (e.g. `enum`, `const`,
 * `items`, `anyOf`) is silently discarded:
 *
 * - `properties` are unioned; a property present in more than one branch must be identical.
 * - `required` is unioned. `additionalProperties: false` wins. Descriptions are concatenated.
 * - Any other keyword must either be absent from the target or deep-equal to the branch value.
 *
 * Intersections that cannot be represented this way (conflicting property schemas, types,
 * enums, nested `anyOf`, ...) are rejected with an error instead of producing a schema that
 * accepts values the original would have rejected. This mirrors the tool-path behaviour in
 * SchemaCompatLayer ("Cannot flatten intersections with overlapping keys").
 */
function mergeAllOfSubschemas(target: JSONSchema7 & Record<string, unknown>, subschemas: JSONSchema7[]): void {
  const mergedProps: Record<string, JSONSchema7> = { ...((target.properties as Record<string, JSONSchema7>) ?? {}) };
  const requiredSet = new Set<string>(Array.isArray(target.required) ? target.required : []);
  const descriptions: string[] =
    typeof target.description === 'string' && target.description ? [target.description] : [];

  for (const sub of subschemas) {
    if (!sub || typeof sub !== 'object') {
      continue;
    }
    for (const [key, value] of Object.entries(sub as Record<string, unknown>)) {
      switch (key) {
        case 'properties': {
          for (const [propName, propSchema] of Object.entries(value as Record<string, JSONSchema7>)) {
            if (propName in mergedProps && !isDeepEqual(mergedProps[propName], propSchema)) {
              throw new Error(
                `Cannot flatten allOf for OpenAI strict mode: property "${propName}" is defined differently in multiple branches`,
              );
            }
            mergedProps[propName] = propSchema;
          }
          break;
        }
        case 'required': {
          if (Array.isArray(value)) {
            for (const name of value) {
              requiredSet.add(name);
            }
          }
          break;
        }
        case 'additionalProperties': {
          if (value === false) {
            target.additionalProperties = false;
          }
          break;
        }
        case 'description': {
          if (typeof value === 'string' && value) {
            descriptions.push(value);
          }
          break;
        }
        default: {
          if (target[key] === undefined) {
            target[key] = value;
          } else if (!isDeepEqual(target[key], value)) {
            throw new Error(`Cannot flatten allOf for OpenAI strict mode: conflicting "${key}" values across branches`);
          }
        }
      }
    }
  }

  if (Object.keys(mergedProps).length) {
    target.properties = mergedProps;
  }
  if (requiredSet.size) {
    target.required = [...requiredSet];
  }
  if (descriptions.length) {
    target.description = descriptions.join(' ');
  }
}

/**
 * Merge constraint phrases into a schema node's description.
 * Mirrors SchemaCompatLayer.mergeParameterDescription phrasing so the strict-mode
 * output path degrades identically to the tool path.
 */
function appendConstraintsToDescription(description: string | undefined, constraints: string[]): string | undefined {
  if (constraints.length === 0) {
    return description;
  }
  const suffix = constraints.join(', ');
  return description ? `${description} (${suffix})` : suffix;
}

/**
 * Recursively remove JSON Schema validation keywords that OpenAI strict mode rejects.
 * Constraints with useful intent (length/number/pattern/format/uniqueness bounds) are folded
 * into the node's `description` — matching how the tool-path SchemaCompatLayer degrades them
 * in schema-compatibility.ts — while purely structural unsupported keywords are dropped.
 */
function stripUnsupportedStrictModeKeywords(schema: JSONSchema7): JSONSchema7 {
  if (typeof schema !== 'object' || schema === null) {
    return schema;
  }

  const result = { ...schema } as JSONSchema7 & Record<string, unknown>;
  const constraints: string[] = [];

  // Array bounds
  const { minItems, maxItems } = result;
  if (minItems !== undefined && maxItems !== undefined && minItems === maxItems) {
    constraints.push(`exact length ${minItems}`);
  } else {
    if (minItems !== undefined) {
      constraints.push(`minimum length ${minItems}`);
    }
    if (maxItems !== undefined) {
      constraints.push(`maximum length ${maxItems}`);
    }
  }
  delete result.minItems;
  delete result.maxItems;

  if (result.uniqueItems === true) {
    constraints.push('all items must be unique');
  }
  delete result.uniqueItems;

  // String bounds
  if (result.minLength !== undefined) {
    constraints.push(`minimum length ${result.minLength}`);
    delete result.minLength;
  }
  if (result.maxLength !== undefined) {
    constraints.push(`maximum length ${result.maxLength}`);
    delete result.maxLength;
  }
  if (result.format !== undefined) {
    constraints.push(`a valid ${result.format}`);
    delete result.format;
  }
  if (result.pattern !== undefined) {
    constraints.push(`input must match this regex ${result.pattern}`);
    delete result.pattern;
  }

  // Number bounds
  if (result.minimum !== undefined) {
    if (result.minimum !== Number.MIN_SAFE_INTEGER) {
      constraints.push(`greater than or equal to ${result.minimum}`);
    }
    delete result.minimum;
  }
  if (result.maximum !== undefined) {
    if (result.maximum !== Number.MAX_SAFE_INTEGER) {
      constraints.push(`lower than or equal to ${result.maximum}`);
    }
    delete result.maximum;
  }
  if (result.exclusiveMinimum !== undefined) {
    constraints.push(`greater than ${result.exclusiveMinimum}`);
    delete result.exclusiveMinimum;
  }
  if (result.exclusiveMaximum !== undefined) {
    constraints.push(`lower than ${result.exclusiveMaximum}`);
    delete result.exclusiveMaximum;
  }
  if (result.multipleOf !== undefined) {
    constraints.push(`multiple of ${result.multipleOf}`);
    delete result.multipleOf;
  }

  // Structural unsupported keywords with no useful natural-language mapping
  for (const keyword of STRICT_MODE_DROPPED_KEYWORDS) {
    delete result[keyword];
  }

  if (constraints.length) {
    result.description = appendConstraintsToDescription(result.description, constraints);
  }

  if (result.properties) {
    result.properties = Object.fromEntries(
      Object.entries(result.properties).map(([key, value]) => [
        key,
        stripUnsupportedStrictModeKeywords(value as JSONSchema7),
      ]),
    );
  }

  if (result.items) {
    if (Array.isArray(result.items)) {
      result.items = result.items.map(item => stripUnsupportedStrictModeKeywords(item as JSONSchema7));
    } else if (typeof result.items === 'object') {
      result.items = stripUnsupportedStrictModeKeywords(result.items as JSONSchema7);
    }
  }

  if (result.additionalProperties && typeof result.additionalProperties === 'object') {
    result.additionalProperties = stripUnsupportedStrictModeKeywords(result.additionalProperties as JSONSchema7);
  }

  // anyOf is the only composition keyword OpenAI strict mode supports; keep it, strip its branches.
  if (result.anyOf && Array.isArray(result.anyOf)) {
    result.anyOf = result.anyOf.map(s => stripUnsupportedStrictModeKeywords(s as JSONSchema7));
  }

  // oneOf is unsupported; anyOf is the documented replacement, so convert it.
  // When both are present the schema is a conjunction (value must satisfy both lists);
  // concatenating the branches would turn that into a union, so reject instead.
  if (result.oneOf && Array.isArray(result.oneOf)) {
    if (Array.isArray(result.anyOf)) {
      throw new Error(
        'Cannot convert schema for OpenAI strict mode: "oneOf" and "anyOf" on the same node cannot be merged without changing semantics',
      );
    }
    result.anyOf = result.oneOf.map(s => stripUnsupportedStrictModeKeywords(s as JSONSchema7));
    delete result.oneOf;
  }

  // allOf is unsupported; flatten the intersection into the containing node.
  if (result.allOf && Array.isArray(result.allOf)) {
    const merged = result.allOf.map(s => stripUnsupportedStrictModeKeywords(s as JSONSchema7));
    delete result.allOf;
    mergeAllOfSubschemas(result, merged);
  }

  applyToDefinitions(result, stripUnsupportedStrictModeKeywords);

  return result;
}

function ensureAdditionalPropertiesFalse(schema: JSONSchema7): JSONSchema7 {
  if (typeof schema !== 'object' || schema === null) {
    return schema;
  }

  const result = { ...schema };

  if (result.type === 'object' || result.properties) {
    result.additionalProperties = false;
  }

  if (result.properties) {
    result.properties = Object.fromEntries(
      Object.entries(result.properties).map(([key, value]) => [
        key,
        ensureAdditionalPropertiesFalse(value as JSONSchema7),
      ]),
    );
  }

  if (result.items) {
    if (Array.isArray(result.items)) {
      result.items = result.items.map(item => ensureAdditionalPropertiesFalse(item as JSONSchema7));
    } else if (typeof result.items === 'object') {
      result.items = ensureAdditionalPropertiesFalse(result.items);
    }
  }

  if (result.anyOf && Array.isArray(result.anyOf)) {
    result.anyOf = result.anyOf.map(s => ensureAdditionalPropertiesFalse(s as JSONSchema7));
  }
  if (result.oneOf && Array.isArray(result.oneOf)) {
    result.oneOf = result.oneOf.map(s => ensureAdditionalPropertiesFalse(s as JSONSchema7));
  }
  if (result.allOf && Array.isArray(result.allOf)) {
    result.allOf = result.allOf.map(s => ensureAdditionalPropertiesFalse(s as JSONSchema7));
  }

  applyToDefinitions(result, ensureAdditionalPropertiesFalse);

  return result;
}

// export function zotToJsonSchema(zodSchema: ZodSchemaV3 | ZodSchemaV4, target: Targets = 'jsonSchema7', strategy: 'none' | 'seen' | 'root' | 'relative' = 'relative'): JSONSchema7 {
//   const target = 'draft-07' as StandardJSONSchemaV1.Target;
//   const standardSchema = toStandardSchema(zodSchema);
//   const jsonSchema = standardSchemaToJSONSchema(standardSchema, {
//     target,
//   });

//   traverse(jsonSchema, {
//     cb: {
//       pre: (schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema) => {
//         this.preProcessJSONNode(schema, parentSchema);
//       },
//       post: (schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema) => {
//         this.postProcessJSONNode(schema, parentSchema);
//       },
//     },
//   });

// }

export function zodToJsonSchema(
  zodSchema: any,
  target: Targets = 'jsonSchema7',
  strategy: 'none' | 'seen' | 'root' | 'relative' = 'relative',
): JSONSchema7 {
  // Route based on whether the schema is v4 (has _zod) or v3 (only has _def).
  // We use zV4.toJSONSchema (imported from 'zod/v4') for v4 schemas, since the
  // default 'zod' import may resolve to v3 depending on the environment.
  // Without this check, v3 schemas passed to v4's toJSONSchema would throw
  // "Cannot read properties of undefined (reading 'def')".
  if (zodSchema?._zod) {
    // Zod v4 path - patch record schemas before converting
    patchRecordSchemas(zodSchema);

    const jsonSchema = zV4.toJSONSchema(zodSchema, {
      unrepresentable: 'any',
      io: 'input',
      override: (ctx: any) => {
        // Handle both Zod v4 structures: _def directly or nested in _zod
        const def = ctx.zodSchema?._def || ctx.zodSchema?._zod?.def;
        // Check for date type using both possible property names
        if (def && (def.typeName === 'ZodDate' || def.type === 'date')) {
          ctx.jsonSchema.type = 'string';
          ctx.jsonSchema.format = 'date-time';
        }
        // Add additionalProperties: false for object types to match Zod v3 behavior
        // This is required for OpenAI strict mode function calling
        if (def && (def.typeName === 'ZodObject' || def.type === 'object')) {
          ctx.jsonSchema.additionalProperties = false;
        }
      },
    }) as JSONSchema7;

    // Fix anyOf patterns for nullable fields - required for OpenAI compatibility
    return fixAnyOfNullable(jsonSchema);
  } else {
    // Zod v3 path - use the original converter
    return zodToJsonSchemaOriginal(zodSchema as ZodSchemaV3, {
      $refStrategy: strategy,
      target,
    }) as JSONSchema7;
  }
}
