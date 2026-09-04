export const WORKFLOW_AUTHORING_TOOL_IDS = {
  listAgents: 'list-available-agents',
  listTools: 'list-available-tools',
  listWorkflows: 'list-available-workflows',
  saveWorkflow: 'save-workflow',
} as const;

export const WORKFLOW_MANAGEMENT_TOOL_IDS = {
  createWorkflow: 'create-workflow',
  listWorkflows: 'list-workflows',
  getWorkflow: 'get-workflow',
  runWorkflow: 'run-workflow',
  deleteWorkflow: 'delete-workflow',
} as const;

export const WORKFLOW_BUILDER_NOISE_TOOL_IDS = [
  ...Object.values(WORKFLOW_AUTHORING_TOOL_IDS),
  ...Object.values(WORKFLOW_MANAGEMENT_TOOL_IDS),
] as const;
