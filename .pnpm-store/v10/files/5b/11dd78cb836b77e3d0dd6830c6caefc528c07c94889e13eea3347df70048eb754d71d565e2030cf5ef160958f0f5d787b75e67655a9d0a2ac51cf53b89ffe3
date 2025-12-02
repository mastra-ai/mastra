import { M as MissingDependencyError } from './index-CLddUTqr.js';
import 'quansync';

const zodv4Error = new MissingDependencyError("zod v4");
async function getToJsonSchemaFn() {
  return async (schema, options) => {
    let handler;
    if ("_zod" in schema) {
      try {
        const mod = await import('zod/v4/core');
        handler = mod.toJSONSchema;
      } catch {
        throw zodv4Error;
      }
    } else {
      try {
        const mod = await import('zod-to-json-schema');
        handler = mod.zodToJsonSchema;
      } catch {
        throw new MissingDependencyError("zod-to-json-schema");
      }
    }
    return handler(schema, options);
  };
}

export { getToJsonSchemaFn as default };
