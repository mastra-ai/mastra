import { toJsonSchema } from '@standard-community/standard-json';
import { convertToOpenAPISchema } from './vendors/convert.js';

function getToOpenAPISchemaFn() {
  return async (schema, context) => convertToOpenAPISchema(
    await toJsonSchema(schema, context.options),
    context
  );
}

export { getToOpenAPISchemaFn as default };
