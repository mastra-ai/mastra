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

function withoutFormats(schema: Schema | boolean): Schema | boolean {
  if (typeof schema === 'boolean') return schema;
  return JSON.parse(JSON.stringify(schema, (key, value) => (key === 'format' ? undefined : value))) as Schema;
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
