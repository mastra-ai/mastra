import { resolveAuthenticatedCredentialTenant } from '@mastra/code-sdk/agents/credential-resolver';
import type { CredentialTenant } from '@mastra/code-sdk/agents/credential-resolver';
import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';

import { UUID_PATTERN } from '../routes/contracts.js';
import { tenantOrgId } from '../routes/provider-credentials.js';
import type { ModelDefaultRecord, ModelDefaultsStorage } from '../storage/domains/model-defaults/base.js';
import { effectiveModelScope } from '../storage/domains/projects/base.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import type { SourceControlSessionLookup } from './factory-session.js';

const FACTORY_PROJECT_ID = new RegExp(UUID_PATTERN);

export interface FactoryModelPolicyDependencies {
  projects: Pick<FactoryProjectsStorage, 'getById'>;
  sourceControl: Pick<SourceControlSessionLookup, 'getBySessionId'>;
  workItems: Pick<WorkItemsStorage, 'findRunBindingByThread'>;
}

/** Resolve billing authority from authenticated identity and durable bindings, never session state. */
export async function resolveFactoryCredentialTenant(
  requestContext: RequestContext,
  deps: FactoryModelPolicyDependencies,
): Promise<CredentialTenant | undefined> {
  return (await resolveFactoryModelPolicy(requestContext, deps))?.tenant;
}

/** Shared invocation and model-picker policy; no client-supplied owner or scope is trusted. */
export async function resolveFactoryModelPolicy(
  requestContext: RequestContext,
  deps: FactoryModelPolicyDependencies,
): Promise<{ tenant: CredentialTenant; factoryProjectId?: string; factoryDefaultModelId?: string | null } | undefined> {
  const principal = resolveAuthenticatedCredentialTenant(requestContext);
  if (!principal) return undefined;
  const controller = requestContext.get('controller') as AgentControllerRequestContext | undefined;
  if (!controller?.sessionId || !controller.resourceId) return { tenant: principal };
  const { sessionId, resourceId } = controller;

  const sourceSession = await deps.sourceControl.getBySessionId(sessionId);
  const binding =
    principal.orgId && controller.threadId
      ? await deps.workItems.findRunBindingByThread({
          orgId: principal.orgId,
          resourceId,
          sessionId,
          threadId: controller.threadId,
          rejectAmbiguous: true,
        })
      : null;
  if (!sourceSession) {
    if (!binding && (resourceId === principal.userId || resourceId.startsWith('channel:'))) {
      return { tenant: principal };
    }
    // Session-less Factory pages address the Factory itself: session and resource are both the
    // project id. A run session under its Factory's resource whose row is gone is not a page.
    const factoryProject =
      !binding && sessionId === resourceId && FACTORY_PROJECT_ID.test(resourceId)
        ? await deps.projects.getById({ id: resourceId })
        : null;
    if (factoryProject && factoryProject.orgId === principal.orgId) {
      return {
        factoryProjectId: factoryProject.id,
        factoryDefaultModelId: factoryProject.defaultModelId,
        tenant: { ...principal, credentialScope: effectiveModelScope(factoryProject.modelScope, 'session') },
      };
    }
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
  // Work-item threads keep their billing scope after revocation; history never restores run authority.
  return {
    factoryProjectId: project.id,
    factoryDefaultModelId: project.defaultModelId,
    tenant: {
      orgId: project.orgId,
      userId: sourceSession.userId,
      credentialScope: effectiveModelScope(project.modelScope, binding ? 'run' : 'session'),
    },
  };
}

/** The personal defaults a policy's tenant runs on; none on Factory routing. */
export async function routedPersonalDefaults(
  tenant: CredentialTenant,
  modelDefaults: Pick<ModelDefaultsStorage, 'ensureReady' | 'get'>,
): Promise<ModelDefaultRecord | null> {
  if (tenant.credentialScope === 'factory') return null;
  await modelDefaults.ensureReady();
  return modelDefaults.get({ orgId: tenantOrgId(tenant), userId: tenant.userId });
}
