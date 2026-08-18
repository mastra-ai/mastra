import type { JsonSchema } from '../dynamic/json-schema-to-zod';
import { inferGraphSchemas } from '../dynamic/validate/schema-flow';
import { schemaCompatibility, type SchemaCompatibility } from '../dynamic/validate/schema-utils';
import type { WorkflowRegistryIndex, WorkflowValidationIssue } from '../dynamic/validate/types';
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

export function compareWorkflowBuilderSchemas(source: unknown, destination: unknown): SchemaCompatibility {
  return schemaCompatibility(source, destination);
}
