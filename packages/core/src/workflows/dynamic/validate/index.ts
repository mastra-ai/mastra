/**
 * The one dynamic-workflow validation domain.
 *
 * `validateDynamicWorkflow` is the collect-mode core every surface shares:
 * structure, JSON-Schema keywords, registry references, and schema-flow
 * analysis, each emitting `{ code, path, message }` issues. UIs consume the
 * array; the save path throws via `assertValidDynamicWorkflow`.
 */
import { validateWorkflowRefs } from './refs';
import { addWorkflowValidationRepairActions } from './repair-actions';
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
  WorkflowValidationRepairAction,
  WorkflowValidationRepairSource,
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
export function validateDynamicWorkflow(
  def: WorkflowValidationInput,
  index: WorkflowRegistryIndex = {},
): WorkflowValidationIssue[] {
  const inference = inferGraphSchemas(def, index);
  return addWorkflowValidationRepairActions(
    def,
    index,
    [
      ...validateWorkflowStructure(def),
      ...validateWorkflowSchemas(def),
      ...validateWorkflowRefs(def, index),
      ...inference.issues,
    ],
    inference.stepOutputs,
    inference.entryInputs,
    inference.finalOutput,
  );
}

/** Throwing presentation of {@link validateDynamicWorkflow} for the save path. */
export function assertValidDynamicWorkflow(def: WorkflowValidationInput, index: WorkflowRegistryIndex = {}): void {
  const issues = validateDynamicWorkflow(def, index);
  if (issues.length === 0) return;
  const details = issues.map(issue => `- [${issue.code}] ${issue.path}: ${issue.message}`).join('\n');
  throw new Error(`Dynamic workflow "${def.id}" failed validation with ${issues.length} issue(s):\n${details}`);
}
