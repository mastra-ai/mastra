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

const SCHEMA_TYPES = new Set(['array', 'boolean', 'integer', 'null', 'number', 'object', 'string']);
const SCHEMA_MAP_KEYWORDS = [
  '$defs',
  'definitions',
  'properties',
  'patternProperties',
  'dependentSchemas',
  'dependencies',
];
const SCHEMA_ARRAY_KEYWORDS = ['prefixItems', 'allOf', 'anyOf', 'oneOf'];
const SCHEMA_KEYWORDS = [
  'additionalProperties',
  'unevaluatedProperties',
  'additionalItems',
  'unevaluatedItems',
  'contains',
  'propertyNames',
  'not',
  'if',
  'then',
  'else',
  'contentSchema',
];

const isStringArray = (value: unknown) => Array.isArray(value) && value.every(item => typeof item === 'string');
const isNumber = (value: unknown) => typeof value === 'number';
const isCount = (value: unknown) => Number.isInteger(value) && (value as number) >= 0;
const isString = (value: unknown) => typeof value === 'string';
const isBoolean = (value: unknown) => typeof value === 'boolean';

/** Value types the meta-schema requires for the keywords that do not hold subschemas. */
const KEYWORD_VALUE_CHECKS: Record<string, [(value: unknown) => boolean, string]> = {
  multipleOf: [value => isNumber(value) && (value as number) > 0, 'a positive number'],
  ...Object.fromEntries(
    ['maximum', 'exclusiveMaximum', 'minimum', 'exclusiveMinimum'].map(k => [k, [isNumber, 'a number']]),
  ),
  ...Object.fromEntries(
    ['maxLength', 'minLength', 'maxItems', 'minItems', 'maxProperties', 'minProperties'].map(k => [
      k,
      [isCount, 'a non-negative integer'],
    ]),
  ),
  ...Object.fromEntries(
    [
      '$id',
      '$schema',
      '$ref',
      '$comment',
      'title',
      'description',
      'pattern',
      'format',
      'contentMediaType',
      'contentEncoding',
    ].map(k => [k, [isString, 'a string']]),
  ),
  ...Object.fromEntries(['readOnly', 'writeOnly', 'uniqueItems'].map(k => [k, [isBoolean, 'a boolean']])),
  examples: [Array.isArray, 'an array'],
  enum: [Array.isArray, 'an array'],
  required: [isStringArray, 'an array of strings'],
};

/**
 * Fallback for runtimes where the cf-worker validator cannot be imported. Applies the same rules as
 * {@link INPUT_SCHEMA_META_SCHEMA}: every subschema is an object or boolean, and every known
 * keyword has a value of the right type.
 */
function getStructuralInputSchemaError(schema: object): string | undefined {
  const seen = new Set<object>();
  const stack: { value: unknown; path: string }[] = [{ value: schema, path: '#' }];
  while (stack.length > 0) {
    const { value, path } = stack.pop()!;
    if (typeof value === 'boolean') continue;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return `${path}: must be a JSON Schema object or boolean`;
    }
    if (seen.has(value)) continue;
    seen.add(value);

    const record = value as Record<string, unknown>;
    const { type, dependentRequired } = record;
    const types = Array.isArray(type) ? type : [type];
    if (type !== undefined && (types.length === 0 || !types.every(t => SCHEMA_TYPES.has(t as string)))) {
      return `${path}/type: must be a JSON Schema type name or a non-empty array of them`;
    }
    for (const [keyword, [isValid, expected]] of Object.entries(KEYWORD_VALUE_CHECKS)) {
      if (record[keyword] !== undefined && !isValid(record[keyword])) return `${path}/${keyword}: must be ${expected}`;
    }
    if (
      dependentRequired !== undefined &&
      (!dependentRequired ||
        typeof dependentRequired !== 'object' ||
        Array.isArray(dependentRequired) ||
        !Object.values(dependentRequired).every(isStringArray))
    ) {
      return `${path}/dependentRequired: must be an object of string arrays`;
    }

    for (const keyword of SCHEMA_MAP_KEYWORDS) {
      const schemas = record[keyword];
      if (schemas === undefined) continue;
      if (!schemas || typeof schemas !== 'object' || Array.isArray(schemas)) {
        return `${path}/${keyword}: must be an object`;
      }
      for (const [key, child] of Object.entries(schemas)) {
        // draft-07 `dependencies` entries may also list required property names.
        if (keyword === 'dependencies' && isStringArray(child)) continue;
        stack.push({ value: child, path: `${path}/${keyword}/${key}` });
      }
    }
    for (const keyword of SCHEMA_ARRAY_KEYWORDS) {
      const schemas = record[keyword];
      if (schemas === undefined) continue;
      if (!Array.isArray(schemas) || schemas.length === 0) return `${path}/${keyword}: must be a non-empty array`;
      schemas.forEach((child, index) => stack.push({ value: child, path: `${path}/${keyword}/${index}` }));
    }
    // `items` is a schema, or a non-empty tuple of schemas in draft-07.
    if (Array.isArray(record.items)) {
      if (record.items.length === 0) return `${path}/items: must be a schema or a non-empty array`;
      record.items.forEach((child, index) => stack.push({ value: child, path: `${path}/items/${index}` }));
    } else if (record.items !== undefined) {
      stack.push({ value: record.items, path: `${path}/items` });
    }
    for (const keyword of SCHEMA_KEYWORDS) {
      if (record[keyword] !== undefined) stack.push({ value: record[keyword], path: `${path}/${keyword}` });
    }
  }
  return undefined;
}

/**
 * Loads the SDK's cf-worker validator, which interprets schemas instead of compiling them with
 * `new Function`, so it also runs on Cloudflare Workers. It is imported lazily because
 * `@cfworker/json-schema` builds a URL from `self.location` at import time, which throws in some
 * browser worker locations; importing `@mastra/mcp` must not fail there. Until it has loaded, or
 * if it cannot load, the structural fallback check is used instead.
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
 * Checks a server-supplied input schema against {@link INPUT_SCHEMA_META_SCHEMA}, falling back to
 * a structural check while the validator is not loaded. Callers must rule out oversized schemas
 * with getJsonSchemaComplexityError first.
 */
export function getInputSchemaError(schema: unknown): string | undefined {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return '#: input schema must be a JSON object';
  if (!inputSchemaMetaValidator) return getStructuralInputSchemaError(schema);
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
