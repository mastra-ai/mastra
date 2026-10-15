import {
  resolveAuthenticatedCredentialTenant,
  type CredentialTenant,
} from '@mastra/code-sdk/agents/credential-resolver';
import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';

import { UUID_PATTERN } from '../routes/contracts.js';
import { effectiveModelScope } from '../storage/domains/projects/base.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { parseSupervisorResourceId } from '../supervisor/session.js';
import type { SourceControlSessionLookup } from './factory-session.js';

const FACTORY_PROJECT_ID = new RegExp(UUID_PATTERN);

interface FactoryModelPolicyDependencies {
  projects: Pick<FactoryProjectsStorage, 'getById'>;
  sourceControl: Pick<SourceControlSessionLookup, 'getBySessionId'>;
  workItems: Pick<WorkItemsStorage, 'findRunBindingByThread'>;
}

type FactoryModelPolicyFailure =
  | 'supervisor-project-unavailable'
  | 'no-session'
  | 'session-not-visible'
  | 'session-without-factory'
  | 'project-unavailable';

/**
 * Policy refusal carrying the request it refused. Model calls and agent-controller reads surface it as an
 * opaque handler error, so the message names the resource, thread and caller to make logs actionable.
 */
export class FactoryModelPolicyError extends Error {
  readonly reason: FactoryModelPolicyFailure;
  readonly details: Readonly<Record<string, string>>;

  constructor(summary: string, reason: FactoryModelPolicyFailure, details: Record<string, string | null | undefined>) {
    const present = Object.fromEntries(
      Object.entries(details).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    );
    const context = Object.entries({ reason, ...present })
      .map(([key, value]) => `${key}=${value}`)
      .join(' ');
    super(`${summary} [${context}]`);
    this.name = 'FactoryModelPolicyError';
    this.reason = reason;
    this.details = present;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resourceKind(resourceId: string, userId: string | undefined): string {
  if (resourceId === userId) return 'user';
  if (resourceId.startsWith('channel:')) return 'channel';
  if (parseSupervisorResourceId(resourceId)) return 'supervisor';
  return UUID.test(resourceId) ? 'uuid' : 'other';
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
  if (!controller?.resourceId) return { tenant: principal };

  const request = {
    resourceId: controller.resourceId,
    resourceKind: resourceKind(controller.resourceId, principal.userId),
    threadId: controller.threadId,
    userId: principal.userId,
  };
  const supervisorProjectId = parseSupervisorResourceId(controller.resourceId);
  if (supervisorProjectId) {
    const project = await deps.projects.getById({ id: supervisorProjectId });
    if (!project || project.orgId !== principal.orgId) {
      throw new FactoryModelPolicyError('Factory model policy is unavailable.', 'supervisor-project-unavailable', {
        ...request,
        projectId: supervisorProjectId,
        project: project ? 'other-org' : 'missing',
      });
    }
    // Supervisor turns are Factory-owned automation, so a hybrid Factory bills them as runs.
    return {
      factoryProjectId: project.id,
      factoryDefaultModelId: project.defaultModelId,
      tenant: {
        orgId: project.orgId,
        userId: project.createdBy,
        credentialScope: effectiveModelScope(project.modelScope, 'run'),
      },
    };
  }

  const sourceSession = await deps.sourceControl.getBySessionId(controller.resourceId);
  const binding =
    principal.orgId && controller.threadId
      ? await deps.workItems.findRunBindingByThread({
          orgId: principal.orgId,
          resourceId: controller.resourceId,
          sessionId: controller.resourceId,
          threadId: controller.threadId,
          rejectAmbiguous: true,
        })
      : null;
  if (!sourceSession) {
    if (!binding && (controller.resourceId === principal.userId || controller.resourceId.startsWith('channel:')))
      return { tenant: principal };
    // Session-less Factory pages address the Factory itself: the resourceId is the project id.
    const factoryProject =
      !binding && FACTORY_PROJECT_ID.test(controller.resourceId)
        ? await deps.projects.getById({ id: controller.resourceId })
        : null;
    if (factoryProject && factoryProject.orgId === principal.orgId) {
      return {
        factoryProjectId: factoryProject.id,
        factoryDefaultModelId: factoryProject.defaultModelId,
        tenant: { ...principal, credentialScope: effectiveModelScope(factoryProject.modelScope, 'session') },
      };
    }
    throw new FactoryModelPolicyError('Factory session ownership is unavailable.', 'no-session', {
      ...request,
      runBinding: binding ? binding.factoryProjectId : 'none',
      factoryProject: factoryProject ? 'other-org' : undefined,
    });
  }
  if (
    sourceSession.orgId !== principal.orgId ||
    (sourceSession.visibility === 'private' && sourceSession.userId !== principal.userId)
  ) {
    throw new FactoryModelPolicyError('Factory session is not available to the current user.', 'session-not-visible', {
      ...request,
      session: sourceSession.orgId !== principal.orgId ? 'other-org' : 'private-to-another-user',
    });
  }
  if (!sourceSession.factoryProjectId) {
    throw new FactoryModelPolicyError('Factory session ownership is unavailable.', 'session-without-factory', request);
  }
  const projectId = binding?.factoryProjectId ?? sourceSession.factoryProjectId;
  const project = await deps.projects.getById({ id: projectId });
  if (!project || project.orgId !== sourceSession.orgId) {
    throw new FactoryModelPolicyError('Factory model policy is unavailable.', 'project-unavailable', {
      ...request,
      projectId,
      projectSource: binding ? 'run-binding' : 'session',
      project: project ? 'other-org' : 'missing',
    });
  }
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
