export interface AgentControllerMutationArgs {
  agentControllerId: string;
  resourceId: string;
  scope?: string;
  baseUrl?: string;
  enabled?: boolean;
}

/**
 * Serialize mutations that change one controller session's active thread,
 * mode, or model. Those operations all target the same mutable server state,
 * so letting them resolve out of order can leave the session on an older user
 * selection.
 */
export function agentControllerSessionMutationScope({
  agentControllerId,
  resourceId,
  scope,
  baseUrl = '',
}: AgentControllerMutationArgs) {
  return { id: JSON.stringify([baseUrl, agentControllerId, resourceId, scope ?? '']) };
}

export function agentControllerSessionMutationKey(
  { agentControllerId, resourceId, scope, baseUrl = '' }: AgentControllerMutationArgs,
  operation: 'thread',
) {
  return ['agent-controller-session-mutation', baseUrl, agentControllerId, resourceId, scope ?? '', operation] as const;
}
