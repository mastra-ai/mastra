/**
 * Extract a JSON Schema from a Mastra tool's schema field. Tools created via
 * `createTool({...})` wrap their Zod schemas with `toStandardSchema`, exposing
 * `['~standard'].jsonSchema` as a `{ input(opts), output(opts) }` converter
 * (see packages/schema-compat/src/standard-schema/adapters/zod-v3.ts:110-119).
 * `direction` selects which side — pass 'input' for inputSchema, 'output' for
 * outputSchema. Returns undefined if the schema is missing or not
 * standard-schema-compliant — the workflow-builder agent then knows the tool's
 * shape is opaque and must reshape via mapping.
 */
export function extractJsonSchema(maybeSchema: unknown, direction: 'input' | 'output'): unknown | undefined {
  try {
    const s = maybeSchema as
      | {
          ['~standard']?: {
            jsonSchema?: { input?: (opts: unknown) => unknown; output?: (opts: unknown) => unknown };
          };
        }
      | undefined;
    const converter = s?.['~standard']?.jsonSchema;
    return converter?.[direction]?.({ target: 'draft-2020-12' });
  } catch {
    return undefined;
  }
}
