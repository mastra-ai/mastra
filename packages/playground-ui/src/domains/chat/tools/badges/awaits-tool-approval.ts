import type { ToolApprovalRequest } from './tool-approval-badge';

type ToolApprovalState = Pick<ToolApprovalRequest, 'toolApprovalMetadata' | 'toolCalled'>;

export function awaitsToolApproval({ toolApprovalMetadata, toolCalled }: ToolApprovalState): boolean {
  return Boolean(toolApprovalMetadata) && !toolCalled;
}
