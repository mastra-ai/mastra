import type { ClientToolsInput } from '@mastra/react';

export type WorkflowGenerationPhase = 'constructing' | 'checkpointed' | 'repairing' | 'finalized';

const WORKFLOW_MUTATION_TOOL_IDS = new Set([
  'insert-workflow-mapping-before',
  'insert-workflow-mapping-after',
  'set-workflow-mapping-source',
  'set-workflow-predicate',
  'add-workflow-step',
  'update-workflow-step',
  'remove-workflow-step',
  'set-workflow-metadata',
]);

const WORKFLOW_INSPECTION_TOOL_IDS = new Set([
  'get-tool-schema',
  'get-agent-schema',
  'get-workflow-schema',
  'list-compatible-sources',
  'explain-validation-issue',
]);

export function isWorkflowMutationTool(toolId: string) {
  return WORKFLOW_MUTATION_TOOL_IDS.has(toolId);
}

export function isWorkflowToolVisibleInPhase(toolId: string, phase: WorkflowGenerationPhase) {
  if (phase === 'finalized') return false;
  if (WORKFLOW_INSPECTION_TOOL_IDS.has(toolId)) return true;
  if (phase === 'checkpointed') return toolId === 'finalize-workflow-draft';
  if (phase === 'repairing') {
    return isWorkflowMutationTool(toolId) || toolId === 'checkpoint-workflow-candidate';
  }
  return isWorkflowMutationTool(toolId) || toolId === 'checkpoint-workflow-draft';
}

export function getWorkflowToolsForPhase(tools: ClientToolsInput, phase: WorkflowGenerationPhase): ClientToolsInput {
  return Object.fromEntries(Object.entries(tools).filter(([toolId]) => isWorkflowToolVisibleInPhase(toolId, phase)));
}
