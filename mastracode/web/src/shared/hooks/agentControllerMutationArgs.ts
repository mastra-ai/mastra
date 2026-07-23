export interface AgentControllerMutationArgs {
  agentControllerId: string;
  resourceId: string;
  scope?: string;
  baseUrl?: string;
  enabled?: boolean;
}

function sessionIdentity({ agentControllerId, resourceId, scope, baseUrl = '' }: AgentControllerMutationArgs) {
  return [baseUrl, agentControllerId, resourceId, scope ?? ''] as const;
}

/**
 * Serialize mutations that change one controller session's active thread,
 * mode, or model. Those operations all target the same mutable server state,
 * so letting them resolve out of order can leave the session on an older user
 * selection.
 */
export function agentControllerSessionMutationScope(args: AgentControllerMutationArgs) {
  return { id: JSON.stringify(sessionIdentity(args)) };
}

export function agentControllerSwitchThreadMutationKey(args: AgentControllerMutationArgs) {
  return ['agent-controller-switch-thread', ...sessionIdentity(args)] as const;
}
