/**
 * JSON-Schema keyword checks: every schema embedded in the definition must be
 * convertible by `jsonSchemaToZod` (no oneOf/anyOf/allOf/not/$ref/
 * patternProperties/discriminator). Covers the four top-level schemas plus
 * each `agent.outputSchema` reachable through containers.
 */
import { forEachSingleStepEntryWithPath } from '../graph';
import { validateStorableJsonSchema } from '../json-schema-to-zod';
import type { JsonSchema } from '../json-schema-to-zod';
import type { WorkflowValidationInput, WorkflowValidationIssue } from './types';

export function validateWorkflowSchemas(def: WorkflowValidationInput): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = [];
  const check = (schema: JsonSchema | undefined, path: string, label: string): void => {
    const result = validateStorableJsonSchema(schema);
    if (result.ok) return;
    issues.push({
      code: 'unsupported-schema-keyword',
      path,
      message: `${label} uses JSON Schema keyword(s) jsonSchemaToZod cannot convert: ${result.unsupported.join(', ')}. Simplify the schema (or extend the converter).`,
    });
  };
  check(def.inputSchema, 'inputSchema', 'inputSchema');
  check(def.outputSchema, 'outputSchema', 'outputSchema');
  if (def.stateSchema) check(def.stateSchema, 'stateSchema', 'stateSchema');
  if (def.requestContextSchema) check(def.requestContextSchema, 'requestContextSchema', 'requestContextSchema');
  forEachSingleStepEntryWithPath(def.graph, (entry, path) => {
    if (entry.type === 'agent' && entry.outputSchema) {
      check(entry.outputSchema, `${path}.outputSchema`, `step "${entry.id}" outputSchema`);
    }
  });
  return issues;
}
