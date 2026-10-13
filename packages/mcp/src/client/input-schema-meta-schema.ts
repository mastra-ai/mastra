import type { JsonSchemaType, JsonSchemaValidator } from '@modelcontextprotocol/client';

/**
 * Structural JSON Schema meta-schema, used to check that a server-supplied tool input schema is
 * shaped like a JSON Schema before it is handed to a model provider.
 *
 * Based on https://json-schema.org/draft-07/schema (`$schema`/`$id` dropped so the validator does
 * not try to resolve them). Draft-07 is used because its meta-schema is a single self-contained
 * document; the 2020-12 meta-schema is split across vocabulary documents. Changes from upstream:
 * - `format`, `uniqueItems` and the non-empty `enum` rule are removed, so only wrong value types
 *   and non-schemas in schema positions drop a tool, not regex dialects, non-URI ids or duplicates;
 * - the block at the end of `properties` adds the 2019-09/2020-12 subschema keywords.
 * Unknown keywords stay allowed, as in every dialect.
 */
export const INPUT_SCHEMA_META_SCHEMA: JsonSchemaType = {
  title: 'Core schema meta-schema',
  definitions: {
    schemaArray: {
      type: 'array',
      minItems: 1,
      items: { $ref: '#' },
    },
    nonNegativeInteger: {
      type: 'integer',
      minimum: 0,
    },
    nonNegativeIntegerDefault0: {
      allOf: [{ $ref: '#/definitions/nonNegativeInteger' }, { default: 0 }],
    },
    simpleTypes: {
      enum: ['array', 'boolean', 'integer', 'null', 'number', 'object', 'string'],
    },
    stringArray: {
      type: 'array',
      items: { type: 'string' },
      default: [],
    },
  },
  type: ['object', 'boolean'],
  properties: {
    $id: {
      type: 'string',
    },
    $schema: {
      type: 'string',
    },
    $ref: {
      type: 'string',
    },
    $comment: {
      type: 'string',
    },
    title: {
      type: 'string',
    },
    description: {
      type: 'string',
    },
    default: true,
    readOnly: {
      type: 'boolean',
      default: false,
    },
    writeOnly: {
      type: 'boolean',
      default: false,
    },
    examples: {
      type: 'array',
      items: true,
    },
    multipleOf: {
      type: 'number',
      exclusiveMinimum: 0,
    },
    maximum: {
      type: 'number',
    },
    exclusiveMaximum: {
      type: 'number',
    },
    minimum: {
      type: 'number',
    },
    exclusiveMinimum: {
      type: 'number',
    },
    maxLength: { $ref: '#/definitions/nonNegativeInteger' },
    minLength: { $ref: '#/definitions/nonNegativeIntegerDefault0' },
    pattern: {
      type: 'string',
    },
    additionalItems: { $ref: '#' },
    items: {
      anyOf: [{ $ref: '#' }, { $ref: '#/definitions/schemaArray' }],
      default: true,
    },
    maxItems: { $ref: '#/definitions/nonNegativeInteger' },
    minItems: { $ref: '#/definitions/nonNegativeIntegerDefault0' },
    uniqueItems: {
      type: 'boolean',
      default: false,
    },
    contains: { $ref: '#' },
    maxProperties: { $ref: '#/definitions/nonNegativeInteger' },
    minProperties: { $ref: '#/definitions/nonNegativeIntegerDefault0' },
    required: { $ref: '#/definitions/stringArray' },
    additionalProperties: { $ref: '#' },
    definitions: {
      type: 'object',
      additionalProperties: { $ref: '#' },
      default: {},
    },
    properties: {
      type: 'object',
      additionalProperties: { $ref: '#' },
      default: {},
    },
    patternProperties: {
      type: 'object',
      additionalProperties: { $ref: '#' },
      default: {},
    },
    dependencies: {
      type: 'object',
      additionalProperties: {
        anyOf: [{ $ref: '#' }, { $ref: '#/definitions/stringArray' }],
      },
    },
    propertyNames: { $ref: '#' },
    const: true,
    enum: {
      type: 'array',
      items: true,
    },
    type: {
      anyOf: [
        { $ref: '#/definitions/simpleTypes' },
        {
          type: 'array',
          items: { $ref: '#/definitions/simpleTypes' },
          minItems: 1,
        },
      ],
    },
    format: { type: 'string' },
    contentMediaType: { type: 'string' },
    contentEncoding: { type: 'string' },
    if: { $ref: '#' },
    then: { $ref: '#' },
    else: { $ref: '#' },
    allOf: { $ref: '#/definitions/schemaArray' },
    anyOf: { $ref: '#/definitions/schemaArray' },
    oneOf: { $ref: '#/definitions/schemaArray' },
    not: { $ref: '#' },

    // Not part of draft-07: subschema keywords added in 2019-09/2020-12.
    $defs: {
      type: 'object',
      additionalProperties: { $ref: '#' },
      default: {},
    },
    prefixItems: { $ref: '#/definitions/schemaArray' },
    dependentSchemas: {
      type: 'object',
      additionalProperties: { $ref: '#' },
    },
    dependentRequired: {
      type: 'object',
      additionalProperties: { $ref: '#/definitions/stringArray' },
    },
    unevaluatedItems: { $ref: '#' },
    unevaluatedProperties: { $ref: '#' },
    contentSchema: { $ref: '#' },
  },
  default: true,
};

let inputSchemaMetaValidator: JsonSchemaValidator<unknown> | undefined;
let inputSchemaMetaValidatorLoad: Promise<void> | undefined;

/**
 * Loads the SDK's cf-worker validator, which interprets schemas instead of compiling them with
 * `new Function`, so it also runs on Cloudflare Workers. It is imported lazily because
 * `@cfworker/json-schema` builds a URL from `self.location` at import time, which throws in some
 * browser worker locations; importing `@mastra/mcp` must not fail there. If loading fails, the
 * check is skipped and schemas are still validated when a tool is called.
 */
export function loadInputSchemaMetaValidator(): Promise<void> {
  inputSchemaMetaValidatorLoad ??= import('@modelcontextprotocol/client/validators/cf-worker').then(
    ({ CfWorkerJsonSchemaValidator }) => {
      inputSchemaMetaValidator = new CfWorkerJsonSchemaValidator({ draft: '7' }).getValidator(INPUT_SCHEMA_META_SCHEMA);
    },
    () => {},
  );
  return inputSchemaMetaValidatorLoad;
}

/**
 * Checks a server-supplied input schema against {@link INPUT_SCHEMA_META_SCHEMA} once
 * {@link loadInputSchemaMetaValidator} has finished. Callers must rule out oversized schemas
 * with getJsonSchemaComplexityError first.
 */
export function getInputSchemaError(schema: unknown): string | undefined {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return '#: input schema must be a JSON object';
  if (!inputSchemaMetaValidator) return undefined;
  let result: ReturnType<typeof inputSchemaMetaValidator>;
  try {
    result = inputSchemaMetaValidator(schema);
  } catch {
    // Only in-process schema objects can be cyclic (wire JSON never is) and the validator recurses
    // until the stack overflows on them. Leave those to the usual call-time validation.
    return undefined;
  }
  // Errors run from the outermost schema to the offending keyword; the last one is the most specific.
  return result.valid ? undefined : result.errorMessage.split('; ').at(-1);
}
