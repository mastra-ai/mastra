/**
 * FGA enforcement utility for checking fine-grained authorization.
 *
 * @license Mastra Enterprise License - see ee/LICENSE
 */

import type { ActorSignal, FGACheckContext, IFGAProvider } from './interfaces/fga';
import type { MastraFGAPermissionInput } from './interfaces/permissions.generated';
import { getSafeLicenseSummary } from './license';
import { captureEEEvent, getEETelemetryFallbackDistinctId } from './telemetry';

export type { ActorSignal };

export interface CheckFGAOptions {
  fgaProvider: IFGAProvider | undefined;
  user: any;
  resource: { type: string; id: string };
  permission: MastraFGAPermissionInput | MastraFGAPermissionInput[];
  context?: FGACheckContext;
  requestContext?: FGACheckContext['requestContext'];
  actor?: ActorSignal;
}

export interface RequireFGAOptions extends CheckFGAOptions {
  metadata?: Record<string, unknown>;
}

function mergeFGAContext({
  context,
  requestContext,
  metadata,
}: Pick<RequireFGAOptions, 'context' | 'requestContext' | 'metadata'>): FGACheckContext | undefined {
  const mergedContext: FGACheckContext = {
    ...context,
  };

  if (requestContext) {
    mergedContext.requestContext = requestContext;
  }

  if (metadata || context?.metadata) {
    mergedContext.metadata = {
      ...(context?.metadata ?? {}),
      ...(metadata ?? {}),
    };
  }

  return Object.keys(mergedContext).length > 0 ? mergedContext : undefined;
}

function isActorSignal(actor: unknown): actor is ActorSignal {
  if (actor === true) {
    return true;
  }

  if (typeof actor !== 'object' || actor === null) {
    return false;
  }

  const candidate = actor as { actorKind?: unknown; sourceWorkflow?: unknown };
  return (
    candidate.actorKind === 'system' &&
    (candidate.sourceWorkflow === undefined || typeof candidate.sourceWorkflow === 'string')
  );
}

export function getAgentFGAResourceId(agentId: string): string {
  return agentId;
}

export function getWorkflowFGAResourceId(workflowId: string): string {
  return workflowId;
}

export function getStandaloneToolFGAResourceId(toolName: string): string {
  return toolName;
}

export function getAgentToolFGAResourceId(agentId: string, toolName: string): string {
  return `${agentId}:${toolName}`;
}

export function getMCPToolFGAResourceId(serverName: string, toolName: string): string {
  return JSON.stringify([serverName, toolName]);
}

/**
 * Check fine-grained authorization for a resource.
 *
 * No-op if no FGA provider is configured (backward compatibility).
 * Delegates to fgaProvider.require() which throws FGADeniedError if denied.
 */
export async function checkFGA(options: CheckFGAOptions): Promise<void> {
  await requireFGA(options);
}

/**
 * Require fine-grained authorization for a resource.
 *
 * No-op if no FGA provider is configured. When FGA is configured, a missing
 * user fails closed.
 */
export async function requireFGA(options: RequireFGAOptions): Promise<void> {
  const { fgaProvider, user, resource, permission, context, requestContext, metadata, actor } = options;

  if (!fgaProvider) {
    return;
  }

  const fgaContext = mergeFGAContext({ context, requestContext, metadata });
  const license = getSafeLicenseSummary();

  if (isActorSignal(actor)) {
    const tenantOrganizationId = fgaContext?.requestContext?.get('organizationId');
    if (typeof tenantOrganizationId !== 'string' || tenantOrganizationId.length === 0) {
      throw new FGADeniedError(user, resource, permission, 'trusted actor requires organizationId / tenant scope');
    }

    const sourceWorkflow =
      (actor === true ? undefined : actor.sourceWorkflow) ??
      (typeof fgaContext?.metadata?.['sourceWorkflow'] === 'string'
        ? fgaContext.metadata['sourceWorkflow']
        : undefined);

    // Provider-aware least privilege: if the provider opts in by implementing
    // requireActor, it decides whether this system actor may perform the action
    // (and throws FGADeniedError to deny). When it is not implemented, the
    // legacy trusted-actor bypass is preserved exactly — zero behavior change.
    const providerEnforced = typeof fgaProvider.requireActor === 'function';
    if (providerEnforced) {
      await fgaProvider.requireActor!(actor, {
        resource,
        permission,
        ...(fgaContext ? { context: fgaContext } : {}),
      });
    }

    try {
      captureEEEvent('ee_feature_used', license.anonymousId || getEETelemetryFallbackDistinctId(), {
        feature: 'fga',
        actor_kind: 'system',
        actor_authorized_by: providerEnforced ? 'provider' : 'bypass',
        resource_type: resource.type,
        resource_id: resource.id,
        permission,
        user_id: null,
        organization_membership_id: null,
        source_workflow: sourceWorkflow,
        license_valid: license.valid,
        license_hash: license.licenseHash,
        is_dev_environment: license.isDevEnvironment,
      });
    } catch {
      // Telemetry must never affect auth or EE feature behavior.
    }
    return;
  }

  if (!user) {
    throw new FGADeniedError(user, resource, permission, 'authenticated user is required');
  }

  await fgaProvider.require(
    user,
    fgaContext ? { resource, permission, context: fgaContext } : { resource, permission },
  );

  try {
    captureEEEvent('ee_feature_used', user?.id || license.anonymousId || getEETelemetryFallbackDistinctId(), {
      feature: 'fga',
      actor_kind: 'user',
      resource_type: resource.type,
      resource_id: resource.id,
      permission,
      user_id: user?.id ?? null,
      organization_membership_id: user?.organizationMembershipId ?? null,
      license_valid: license.valid,
      license_hash: license.licenseHash,
      is_dev_environment: license.isDevEnvironment,
    });
  } catch {
    // Telemetry must never affect auth or EE feature behavior.
  }
}

/**
 * Error thrown when an FGA authorization check is denied.
 */
export class FGADeniedError extends Error {
  public readonly user: any;
  public readonly resource: { type: string; id: string };
  public readonly permission: MastraFGAPermissionInput | MastraFGAPermissionInput[];
  public readonly status: number;

  constructor(
    user: any,
    resource: { type: string; id: string },
    permission: MastraFGAPermissionInput | MastraFGAPermissionInput[],
    reason?: string,
  ) {
    const userId = user?.id || user?.workosId || 'unknown';
    const permissionLabel = Array.isArray(permission) ? `any of [${permission.join(', ')}]` : permission;
    super(
      reason
        ? `FGA authorization denied: ${reason}`
        : `FGA authorization denied: user ${userId} cannot ${permissionLabel} on ${resource.type}:${resource.id}`,
    );
    this.name = 'FGADeniedError';
    this.user = user;
    this.resource = resource;
    this.permission = permission;
    this.status = 403;
  }
}
