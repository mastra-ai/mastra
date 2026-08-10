/**
 * Reference checks against a caller-supplied registry index.
 *
 * Checks are gated per kind: a kind whose key is absent from the index is
 * skipped entirely, so callers that cannot enumerate (say) workflows never
 * produce false missing-reference issues. Mis-classified references get swap
 * hints (agent id that is actually a registered tool, and vice versa).
 *
 * `type: 'step'` descriptors are intentionally not checked — they resolve
 * late against the live Mastra instance at rehydration time.
 */
import { forEachSingleStepEntryWithPath } from '../graph';
import type { WorkflowRegistryIndex, WorkflowValidationInput, WorkflowValidationIssue } from './types';

export function validateWorkflowRefs(
  def: WorkflowValidationInput,
  index: WorkflowRegistryIndex,
): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = [];
  forEachSingleStepEntryWithPath(def.graph, (entry, path) => {
    switch (entry.type) {
      case 'agent': {
        if (!index.agents || index.agents[entry.agentId]) return;
        issues.push({
          code: 'missing-reference',
          path: `${path}.agentId`,
          message: index.tools?.[entry.agentId]
            ? `Step "${entry.id}" declares { type: "agent", agentId: "${entry.agentId}" } but "${entry.agentId}" is a registered TOOL, not an agent. Change this entry to { type: "tool", toolId: "${entry.agentId}" }.`
            : `Step "${entry.id}" declares agentId "${entry.agentId}" which is not a registered agent.`,
        });
        return;
      }
      case 'tool': {
        if (!index.tools || index.tools[entry.toolId]) return;
        issues.push({
          code: 'missing-reference',
          path: `${path}.toolId`,
          message: index.agents?.[entry.toolId]
            ? `Step "${entry.id}" declares { type: "tool", toolId: "${entry.toolId}" } but "${entry.toolId}" is a registered AGENT, not a tool. Change this entry to { type: "agent", agentId: "${entry.toolId}" }.`
            : `Step "${entry.id}" declares toolId "${entry.toolId}" which is not a registered tool.`,
        });
        return;
      }
      case 'workflow': {
        // Self-references are a structural issue (`self-reference`), and the
        // registry may well contain a previous version of this very workflow
        // on upsert — skip the existence check for them.
        if (entry.workflowId === def.id) return;
        if (!index.workflows || index.workflows[entry.workflowId]) return;
        issues.push({
          code: 'missing-reference',
          path: `${path}.workflowId`,
          message: `Step "${entry.id}" declares workflowId "${entry.workflowId}" which is not a registered workflow.`,
        });
        return;
      }
      default:
        return;
    }
  });
  return issues;
}
