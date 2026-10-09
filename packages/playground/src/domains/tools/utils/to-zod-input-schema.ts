import { jsonSchemaToZodRuntime } from '@mastra/playground-ui/lib/form/json-schema-to-zod-runtime';
import { z } from 'zod';
import type { ZodType } from 'zod';
import { isRecord } from './is-record';

/** The Zod schema the Playground form is built from; a tool without an input schema gets an empty form. */
export function toZodInputSchema(inputSchema: unknown): ZodType {
  if (!isRecord(inputSchema)) return z.object({});
  return jsonSchemaToZodRuntime(inputSchema);
}
