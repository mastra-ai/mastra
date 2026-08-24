import type { AgentControllerMutationArgs } from '../../../../hooks/agentControllerMutationArgs';
import { AGENT_CONTROLLER_ID } from './constants';

interface SessionAddressFields {
  resourceId: string;
  projectPath?: string;
  baseUrl?: string;
  sessionEnabled: boolean;
}

/** One place builds the address every agent-controller mutation hook takes. */
export function agentControllerSessionArgs(session: SessionAddressFields): AgentControllerMutationArgs {
  return {
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId: session.resourceId,
    scope: session.projectPath,
    baseUrl: session.baseUrl ?? '',
    enabled: session.sessionEnabled,
  };
}
