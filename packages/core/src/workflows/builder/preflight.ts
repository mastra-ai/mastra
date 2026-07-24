/**
 * Compatibility wrapper over the one stored-workflow validation domain
 * (`workflows/stored/validate/`). Kept so authoring frontends (Studio,
 * mastracode) can keep importing preflight names from
 * `@mastra/core/workflows/builder`; all rules live in the shared core.
 */
import { validateStoredWorkflow } from '../stored/validate/index';
import type {
  WorkflowRegistryIndex,
  WorkflowRegistrySchemas,
  WorkflowValidationIssue,
  WorkflowValidationIssueCode,
} from '../stored/validate/index';
import type { WorkflowBuilderDefinition } from './index';

export type WorkflowDefinitionPreflightIssueCode = WorkflowValidationIssueCode;
export type WorkflowDefinitionPreflightIssue = WorkflowValidationIssue;
export type WorkflowDefinitionDependencySchema = WorkflowRegistrySchemas;
export type WorkflowDefinitionPreflightContext = WorkflowRegistryIndex;

export type WorkflowDefinitionPreflightResult =
  { ok: true } | { ok: false; issues: WorkflowDefinitionPreflightIssue[] };

/**
 * Collect-mode validation of an authoring definition. Context gates the
 * context-dependent checks: reference checks only run for dependency kinds
 * present in the context, and schema-flow compatibility only proves
 * mismatches where schemas are known.
 */
export function preflightWorkflowDefinition(
  definition: WorkflowBuilderDefinition,
  context: WorkflowDefinitionPreflightContext = {},
): WorkflowDefinitionPreflightResult {
  const issues = validateStoredWorkflow(definition, context);
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
