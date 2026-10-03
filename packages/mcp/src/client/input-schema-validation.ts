import type { JSONSchema7 } from '@mastra/schema-compat';
import Ajv from 'ajv';
import Ajv2019 from 'ajv/dist/2019.js';
import Ajv2020 from 'ajv/dist/2020.js';
import { MAX_JSON_SCHEMA_NODES } from '../shared/json-schema-dialect';

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

// Ajv's meta-schema pass visits every JSON value (including enum/const data) and checks
// uniqueness quadratically, so bound the whole document before handing it to Ajv.
function exceedsNodeBudget(schema: unknown): boolean {
  let nodes = 0;
  const stack: unknown[] = [schema];
  while (stack.length > 0) {
    const value = stack.pop();
    nodes += 1;
    if (typeof value !== 'object' || value === null) continue;
    for (const key in value) {
      if (nodes + stack.length >= MAX_JSON_SCHEMA_NODES) return true;
      stack.push((value as Record<string, unknown>)[key]);
    }
  }
  return false;
}

export function validateInputSchema(input: unknown): ValidationResult {
  const schema = isObject(input) && 'jsonSchema' in input ? input.jsonSchema : input;
  if (!isObject(schema)) {
    return { success: false, reason: '/: MCP input schema must be a JSON object' };
  }
  if (exceedsNodeBudget(schema)) {
    return { success: false, reason: `/: JSON Schema exceeds the maximum node count of ${MAX_JSON_SCHEMA_NODES}` };
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
    let valid: boolean;
    try {
      valid = validator.validate(metaSchemas[dialect], schema) as boolean;
    } catch {
      // Ajv can throw on hostile values (e.g. enum objects with a non-callable toString).
      return { success: false, reason: '/: JSON Schema validation failed' };
    }
    if (valid) {
      return { success: true, schema: schema as JSONSchema7 };
    }
    const error = validator.errors?.[0];
    if (error) reason = `${error.instancePath || '/'}: ${error.message}`.slice(0, 400);
  }
  return { success: false, reason };
}
