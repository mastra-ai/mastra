import { Validator } from '@cfworker/json-schema';
import type { OutputUnit, Schema, SchemaDraft } from '@cfworker/json-schema';

export type ValidationError = {
  instancePath: string;
  schemaPath: string;
  keyword: string;
  params: Record<string, never>;
  message: string;
};

export type ValidateFunction = ((value: unknown) => boolean) & {
  errors: ValidationError[] | null;
  $async?: boolean;
};

function getDraft(schema: Schema | boolean): SchemaDraft {
  if (typeof schema === 'boolean' || typeof schema.$schema !== 'string') return '7';
  if (schema.$schema.includes('2020-12')) return '2020-12';
  if (schema.$schema.includes('2019-09')) return '2019-09';
  if (schema.$schema.includes('draft-04')) return '4';
  return '7';
}

const schemaMapKeywords = ['properties', 'patternProperties', 'dependentSchemas', '$defs', 'definitions'] as const;
const schemaKeywords = [
  'additionalProperties',
  'contains',
  'contentSchema',
  'else',
  'if',
  'items',
  'not',
  'propertyNames',
  'then',
  'unevaluatedItems',
  'unevaluatedProperties',
] as const;
const schemaArrayKeywords = ['allOf', 'anyOf', 'oneOf', 'prefixItems'] as const;

function removeFormats(schema: Record<string, unknown>): void {
  delete schema.format;

  for (const keyword of schemaMapKeywords) {
    const schemaMap = schema[keyword];
    if (!schemaMap || typeof schemaMap !== 'object' || Array.isArray(schemaMap)) continue;
    for (const child of Object.values(schemaMap)) {
      if (child && typeof child === 'object' && !Array.isArray(child)) removeFormats(child as Record<string, unknown>);
    }
  }

  for (const keyword of schemaKeywords) {
    const child = schema[keyword];
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === 'object') removeFormats(item as Record<string, unknown>);
      }
    } else if (child && typeof child === 'object') {
      removeFormats(child as Record<string, unknown>);
    }
  }

  for (const keyword of schemaArrayKeywords) {
    const schemas = schema[keyword];
    if (!Array.isArray(schemas)) continue;
    for (const child of schemas) {
      if (child && typeof child === 'object') removeFormats(child as Record<string, unknown>);
    }
  }

  const dependencies = schema.dependencies;
  if (dependencies && typeof dependencies === 'object' && !Array.isArray(dependencies)) {
    for (const child of Object.values(dependencies)) {
      if (child && typeof child === 'object' && !Array.isArray(child)) {
        removeFormats(child as Record<string, unknown>);
      }
    }
  }
}

function withoutFormats(schema: Schema | boolean): Schema | boolean {
  if (typeof schema === 'boolean') return schema;
  const clonedSchema = JSON.parse(JSON.stringify(schema)) as Schema;
  removeFormats(clonedSchema as Record<string, unknown>);
  return clonedSchema;
}

function toValidationError(error: OutputUnit): ValidationError {
  const instancePath = error.instanceLocation.startsWith('#')
    ? error.instanceLocation.slice(1)
    : error.instanceLocation;
  const schemaPath = error.keywordLocation.startsWith('#') ? error.keywordLocation.slice(1) : error.keywordLocation;

  return {
    instancePath,
    schemaPath,
    keyword: error.keyword,
    params: {},
    message: error.error,
  };
}

export function compileDefault(schema: Schema | boolean): ValidateFunction {
  if (typeof schema !== 'boolean' && schema.$async === true) {
    throw new Error('Asynchronous JSON Schema validation is not supported in Cloudflare Workers');
  }

  const validator = new Validator(withoutFormats(schema), getDraft(schema), false);
  const validate = ((value: unknown) => {
    const result = validator.validate(value);
    validate.errors = result.valid ? null : result.errors.map(toValidationError);
    return result.valid;
  }) as ValidateFunction;
  validate.errors = null;

  return validate;
}

export function createAjv(): never {
  throw new Error(
    'AJV customization is not supported in Cloudflare Workers. Remove ajvOptions and getAjv() usage, or configure a custom validation runtime alias.',
  );
}
