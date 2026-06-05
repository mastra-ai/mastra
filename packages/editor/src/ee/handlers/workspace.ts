/**
 * Resolve the workspace id to attach the agent to. Infra-agnostic.
 */
export function resolveWorkspaceId(workspaceId?: string): string | undefined {
  const trimmed = workspaceId?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}
