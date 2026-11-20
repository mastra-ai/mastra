import type { JSONSchema7 } from 'json-schema';

/**
 * What a host shows for an importer class: its form and its credential slots. Plain JSON, so a UI
 * or another process (hosted Knowledge) can render it without the importer's code.
 *
 * @experimental
 */
export interface KnowledgeImporterManifest {
  id: string;
  label: string;
  description?: string;
  /** An http(s) URL or a `data:image/` URI. */
  iconUrl?: string;
  /** Draft-07 JSON Schema of the settings as a binding supplies them (the schema's input side). */
  settingsSchema: JSONSchema7;
  credentials: Record<string, { description: string; secret: boolean }>;
}

/** The settings schema of an importer with no settings: an empty object. */
export const EMPTY_KNOWLEDGE_IMPORTER_SETTINGS_SCHEMA: JSONSchema7 = {
  type: 'object',
  properties: {},
  additionalProperties: false,
};

/** Every `$ref` in a schema, so a manifest can refuse ones that point outside the schema. */
export function jsonSchemaRefs(schema: unknown, refs: string[] = []): string[] {
  if (Array.isArray(schema)) {
    for (const item of schema) jsonSchemaRefs(item, refs);
  } else if (schema && typeof schema === 'object') {
    for (const [key, value] of Object.entries(schema)) {
      if (key === '$ref' && typeof value === 'string') refs.push(value);
      else jsonSchemaRefs(value, refs);
    }
  }
  return refs;
}
