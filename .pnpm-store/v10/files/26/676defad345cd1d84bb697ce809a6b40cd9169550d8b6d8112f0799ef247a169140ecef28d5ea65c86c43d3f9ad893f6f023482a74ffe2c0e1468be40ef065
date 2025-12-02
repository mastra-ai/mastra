import { M as MissingDependencyError } from './index-CLddUTqr.js';
import 'quansync';

async function getToJsonSchemaFn() {
  try {
    const { toJsonSchema } = await import('@valibot/to-json-schema');
    return toJsonSchema;
  } catch {
    throw new MissingDependencyError("@valibot/to-json-schema");
  }
}

export { getToJsonSchemaFn as default };
