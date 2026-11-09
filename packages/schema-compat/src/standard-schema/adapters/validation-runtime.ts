import { Ajv } from 'ajv';
import Ajv2020 from 'ajv/dist/2020.js';
import type { JSONSchema7 } from 'json-schema';

export function createAjv(schema: JSONSchema7, options: ConstructorParameters<typeof Ajv>[0]): Ajv {
  const AjvClass = typeof schema.$schema === 'string' && schema.$schema.includes('2020-12') ? Ajv2020 : Ajv;
  return new AjvClass(options);
}

export function compileDefault(schema: JSONSchema7): ReturnType<Ajv['compile']> {
  return createAjv(schema, { allErrors: true, strict: false }).compile(schema);
}
