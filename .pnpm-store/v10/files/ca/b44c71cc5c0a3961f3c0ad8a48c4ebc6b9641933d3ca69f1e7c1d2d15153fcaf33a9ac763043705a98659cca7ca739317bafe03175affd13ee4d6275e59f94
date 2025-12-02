import { M as MissingDependencyError } from './index-CLddUTqr.js';
import 'quansync';

async function getToJsonSchemaFn() {
  try {
    const { JSONSchema } = await import('effect');
    return (schema) => JSONSchema.make(schema);
  } catch {
    throw new MissingDependencyError("effect");
  }
}

export { getToJsonSchemaFn as default };
