import { M as MissingDependencyError } from './index-CLddUTqr.js';
import 'quansync';

async function getToJsonSchemaFn() {
  try {
    const { toJSONSchema } = await import('sury');
    return toJSONSchema;
  } catch {
    throw new MissingDependencyError("sury");
  }
}

export { getToJsonSchemaFn as default };
