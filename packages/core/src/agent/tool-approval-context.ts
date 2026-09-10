import type { Mastra } from '../mastra';
import type { Agent } from './agent';

/** Immutable ownership and deny-only permission snapshot for a scheduled run. */
export interface ToolApprovalContext {
  controllerId: string;
  scope: string;
  agentId: string;
  resourceId: string;
  threadId: string;
  deniedTools: string[];
  deniedCategories: string[];
}

/** @internal Reuse the native Session consumer without creating or switching a thread. */
export async function bindToolApprovalContext(
  mastra: Mastra | undefined,
  agent: Agent,
  target: Omit<ToolApprovalContext, 'deniedTools' | 'deniedCategories'>,
) {
  const controller = mastra?.getAgentControllerById(target.controllerId);
  if (!controller || agent.id !== target.agentId) throw new Error('Invalid scheduled controller target');
  return controller.createSession({
    resourceId: target.resourceId,
    scope: target.scope,
    threadId: target.threadId,
    existingThreadOnly: true,
    subscriptionAgent: agent,
  });
}
