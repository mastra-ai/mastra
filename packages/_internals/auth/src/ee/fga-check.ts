/**
 * FGA enforcement utility for checking fine-grained authorization.
 *
 * @license Mastra Enterprise License - see ee/LICENSE
 */

import type { FGACheckContext, IFGAProvider } from './interfaces/fga';
import type { MastraFGAPermissionInput } from './interfaces/permissions.generated';
import { getSafeLicenseSummary } from './license';
import { captureEEEvent, getEETelemetryFallbackDistinctId } from './telemetry';

export interface CheckFGAOptions {
  fgaProvider: IFGAProvider | undefined;
  user: any;
  resource: { type: string; id: string };
  permission: MastraFGAPermissionInput | MastraFGAPermissionInput[];
  context?: FGACheckContext;
}

export interface RequireFGAOptions extends CheckFGAOptions {
  requestContext?: FGACheckContext['requestContext'];
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
  const { fgaProvider, user, resource, permission, context, requestContext, metadata } = options;

  if (!fgaProvider) {
    return;
  }

  const fgaContext = mergeFGAContext({ context, requestContext, metadata });

  if (!user) {
    throw new FGADeniedError(user, resource, permission, 'authenticated user is required');
  }

  await fgaProvider.require(
    user,
    fgaContext ? { resource, permission, context: fgaContext } : { resource, permission },
  );

  const license = getSafeLicenseSummary();
  try {
    captureEEEvent('ee_feature_used', user?.id || license.anonymousId || getEETelemetryFallbackDistinctId(), {
      feature: 'fga',
      resource_type: resource.type,
      resource_id: resource.id,
      permission,
      user_id: user?.id,
      organization_membership_id: user?.organizationMembershipId,
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
