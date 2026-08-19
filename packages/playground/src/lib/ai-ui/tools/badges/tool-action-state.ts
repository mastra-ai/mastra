export function isToolApprovalPending(toolApprovalMetadata: unknown, toolCalled: boolean): boolean {
  return toolApprovalMetadata !== undefined && !toolCalled;
}
