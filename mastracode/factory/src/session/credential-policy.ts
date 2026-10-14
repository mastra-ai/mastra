import {
  resolveAuthenticatedCredentialTenant,
  type CredentialTenant,
} from '@mastra/code-sdk/agents/credential-resolver';
import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';

import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { parseSupervisorResourceId } from '../supervisor/session.js';
import type { SourceControlSessionLookup } from './factory-session.js';

/** Resolve billing authority from authenticated identity and durable bindings, never session state. */
export async function resolveFactoryCredentialTenant(
  requestContext: RequestContext,
  deps: {
    projects: FactoryProjectsStorage;
    sourceControl: SourceControlSessionLookup;
    workItems: WorkItemsStorage;
  },
): Promise<CredentialTenant | undefined> {
  const principal = resolveAuthenticatedCredentialTenant(requestContext);
  if (!principal) return undefined;
  const controller = requestContext.get('controller') as AgentControllerRequestContext | undefined;
  if (!controller?.resourceId) return principal;

  const supervisorProjectId = parseSupervisorResourceId(controller.resourceId);
  if (supervisorProjectId) {
    const project = await deps.projects.getById({ id: supervisorProjectId });
    if (!project || project.orgId !== principal.orgId) throw new Error('Factory model policy is unavailable.');
    return { orgId: project.orgId, userId: project.createdBy, credentialScope: project.modelScope };
  }

  const sourceSession = await deps.sourceControl.getBySessionId(controller.resourceId);
  const binding =
    principal.orgId && controller.threadId
      ? await deps.workItems.findActiveRunBindingByThread({
          orgId: principal.orgId,
          resourceId: controller.resourceId,
          sessionId: controller.resourceId,
          threadId: controller.threadId,
          rejectAmbiguous: true,
        })
      : null;
  if (!sourceSession) {
    if (!binding && (controller.resourceId === principal.userId || controller.resourceId.startsWith('channel:')))
      return principal;
    throw new Error('Factory session ownership is unavailable.');
  }
  if (
    sourceSession.orgId !== principal.orgId ||
    (sourceSession.visibility === 'private' && sourceSession.userId !== principal.userId)
  ) {
    throw new Error('Factory session is not available to the current user.');
  }
  if (!sourceSession.factoryProjectId) throw new Error('Factory session ownership is unavailable.');
  const projectId = binding?.factoryProjectId ?? sourceSession.factoryProjectId;
  const project = await deps.projects.getById({ id: projectId });
  if (!project || project.orgId !== sourceSession.orgId) throw new Error('Factory model policy is unavailable.');
  return { orgId: project.orgId, userId: sourceSession.userId, credentialScope: project.modelScope };
}
