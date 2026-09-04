/**
 * Core's `CoreToolBuilder` injects runtime-only override fields into tool input
 * schemas (`_background` for background execution, `suspendedToolRunId` /
 * `resumeData` for resumable tools). Those fields are meant for the LLM tool-call
 * protocol, not for humans filling in a tool-execution form, so we strip them
 * from serialized input schemas returned by the API.
 *
 * `suspendedToolRunId` / `resumeData` are only removed when their description
 * matches the exact injected shape, so a user-authored field with the same name
 * is preserved.
 */

const INJECTED_OVERRIDE_DESCRIPTIONS: Record<string, string> = {
  suspendedToolRunId: 'The runId of the suspended tool',
  resumeData: 'The resumeData object created from the resumeSchema of suspended tool',
};

export function stripInjectedToolOverrideFields<T>(jsonSchema: T): T {
  if (!jsonSchema || typeof jsonSchema !== 'object' || Array.isArray(jsonSchema)) return jsonSchema;
  const schema = jsonSchema as { properties?: Record<string, unknown>; required?: unknown };
  if (!schema.properties || typeof schema.properties !== 'object') return jsonSchema;

  const properties = { ...schema.properties };
  let changed = false;

  if ('_background' in properties) {
    delete properties._background;
    changed = true;
  }

  for (const [key, description] of Object.entries(INJECTED_OVERRIDE_DESCRIPTIONS)) {
    const prop = properties[key];
    if (prop && typeof prop === 'object' && (prop as { description?: string }).description === description) {
      delete properties[key];
      changed = true;
    }
  }

  if (!changed) return jsonSchema;

  const required = Array.isArray(schema.required) ? schema.required.filter(key => key in properties) : schema.required;

  return { ...jsonSchema, properties, ...(required !== undefined ? { required } : {}) };
}
