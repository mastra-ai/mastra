export const WORKFLOW_IDS = ['incrementWorkflow', 'approvalWorkflow'] as const;

export type WorkflowId = (typeof WORKFLOW_IDS)[number];

export function isWorkflowId(value: unknown): value is WorkflowId {
  return typeof value === 'string' && (WORKFLOW_IDS as readonly string[]).includes(value);
}
