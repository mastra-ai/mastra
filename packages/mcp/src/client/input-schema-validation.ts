import type { JSONSchema7 } from '@mastra/schema-compat';
import Ajv from 'ajv';
import Ajv2019 from 'ajv/dist/2019.js';
import Ajv2020 from 'ajv/dist/2020.js';

type ValidationResult = { success: true; schema: JSONSchema7 } | { success: false; reason: string };
type Dialect = 'draft-07' | '2019-09' | '2020-12';

const validators = new Map<Dialect, Ajv>();
const metaSchemas: Record<Dialect, string> = {
  'draft-07': 'http://json-schema.org/draft-07/schema#',
  '2019-09': 'https://json-schema.org/draft/2019-09/schema',
  '2020-12': 'https://json-schema.org/draft/2020-12/schema',
};

function getValidator(dialect: Dialect): Ajv {
  let validator = validators.get(dialect);
  if (!validator) {
    const options = { strict: false, validateFormats: false };
    validator =
      dialect === 'draft-07' ? new Ajv(options) : dialect === '2019-09' ? new Ajv2019(options) : new Ajv2020(options);
    validators.set(dialect, validator);
  }
  return validator;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateInputSchema(input: unknown): ValidationResult {
  const schema = isObject(input) && 'jsonSchema' in input ? input.jsonSchema : input;
  if (!isObject(schema) || schema.type !== 'object') {
    return { success: false, reason: '/: MCP input schema must be an object schema with type "object"' };
  }

  let dialects: Dialect[] = ['draft-07', '2020-12'];
  if ('$schema' in schema) {
    if (typeof schema.$schema !== 'string') {
      return { success: false, reason: '/$schema: must be a supported JSON Schema dialect URI' };
    }
    const uri = schema.$schema.replace(/^http:/, 'https:').replace(/#$/, '');
    const dialect = (Object.keys(metaSchemas) as Dialect[]).find(
      candidate => metaSchemas[candidate].replace(/^http:/, 'https:').replace(/#$/, '') === uri,
    );
    if (!dialect) {
      return { success: false, reason: '/$schema: unsupported JSON Schema dialect' };
    }
    dialects = [dialect];
  }

  let reason = '/: invalid JSON Schema';
  for (const dialect of dialects) {
    const validator = getValidator(dialect);
    // Validate against the meta-schema directly: never compile or retain the tool's schema,
    // register its $id, or resolve its references. URI aliases need no schema mutation.
    if (validator.validate(metaSchemas[dialect], schema)) {
      return { success: true, schema: schema as JSONSchema7 };
    }
    const error = validator.errors?.[0];
    if (error) reason = `${error.instancePath || '/'}: ${error.message}`.slice(0, 400);
  }
  return { success: false, reason };
}
