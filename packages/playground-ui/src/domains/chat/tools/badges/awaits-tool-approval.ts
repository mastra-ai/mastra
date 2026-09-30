import type { ToolApprovalButtonsProps } from './tool-approval-buttons';

type ToolApprovalState = Pick<ToolApprovalButtonsProps, 'toolApprovalMetadata' | 'toolCalled'>;

export function awaitsToolApproval({ toolApprovalMetadata, toolCalled }: ToolApprovalState): boolean {
  return Boolean(toolApprovalMetadata) && !toolCalled;
}
