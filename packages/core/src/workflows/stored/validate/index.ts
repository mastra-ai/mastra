/**
 * The one stored-workflow validation domain.
 *
 * `validateStoredWorkflow` is the collect-mode core every surface shares:
 * structure, JSON-Schema keywords, registry references, and schema-flow
 * analysis, each emitting `{ code, path, message }` issues. UIs consume the
 * array; the save path throws via `assertValidStoredWorkflow`.
 */
import { validateWorkflowRefs } from './refs';
import { inferGraphSchemas } from './schema-flow';
import { validateWorkflowSchemas } from './schemas';
import { validateWorkflowStructure } from './structure';
import type { WorkflowRegistryIndex, WorkflowValidationInput, WorkflowValidationIssue } from './types';

export type {
  ValidatableStepFlowEntry,
  WorkflowRegistryIndex,
  WorkflowRegistrySchemas,
  WorkflowValidationInput,
  WorkflowValidationIssue,
  WorkflowValidationIssueCode,
} from './types';
export { validateWorkflowStructure } from './structure';
export { validateWorkflowRefs } from './refs';
export { validateWorkflowSchemas } from './schemas';
export { inferGraphSchemas } from './schema-flow';
export type { GraphSchemaInference } from './schema-flow';
export { schemaCompatibility, toJsonSchemaOrUndefined } from './schema-utils';
export type { SchemaCompatibility } from './schema-utils';

/**
 * Runs every check and returns the collected issues (empty = valid).
 *
 * The registry index gates context-dependent checks: reference checks only
 * run for kinds present in the index, and schema-flow compatibility only
 * proves mismatches where schemas are known.
 */
export function validateStoredWorkflow(
  def: WorkflowValidationInput,
  index: WorkflowRegistryIndex = {},
): WorkflowValidationIssue[] {
  return [
    ...validateWorkflowStructure(def),
    ...validateWorkflowSchemas(def),
    ...validateWorkflowRefs(def, index),
    ...inferGraphSchemas(def, index).issues,
  ];
}

/** Throwing presentation of {@link validateStoredWorkflow} for the save path. */
export function assertValidStoredWorkflow(def: WorkflowValidationInput, index: WorkflowRegistryIndex = {}): void {
  const issues = validateStoredWorkflow(def, index);
  if (issues.length === 0) return;
  const details = issues.map(issue => `- [${issue.code}] ${issue.path}: ${issue.message}`).join('\n');
  throw new Error(`Stored workflow "${def.id}" failed validation with ${issues.length} issue(s):\n${details}`);
}
