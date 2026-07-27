import type { JsonSchema } from '../stored/json-schema-to-zod';
import { inferGraphSchemas } from '../stored/validate/schema-flow';
import { schemaCompatibility } from '../stored/validate/schema-utils';
import type { WorkflowRegistryIndex, WorkflowValidationIssue } from '../stored/validate/types';
import type { WorkflowBuilderDefinition } from './index';

export interface WorkflowBuilderSchemaInspection {
  stepOutputs: ReadonlyMap<string, JsonSchema | undefined>;
  finalOutput: JsonSchema | undefined;
  issues: WorkflowValidationIssue[];
}

export function inspectWorkflowBuilderSchemas(
  definition: WorkflowBuilderDefinition,
  registry: WorkflowRegistryIndex = {},
): WorkflowBuilderSchemaInspection {
  return inferGraphSchemas(definition, registry);
}

export function compareWorkflowBuilderSchemas(
  source: unknown,
  destination: unknown,
): 'compatible' | 'incompatible' | 'unknown' {
  return schemaCompatibility(source, destination);
}
