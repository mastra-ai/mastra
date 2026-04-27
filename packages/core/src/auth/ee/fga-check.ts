/**
 * FGA enforcement utility for checking fine-grained authorization.
 *
 * @license Mastra Enterprise License - see ee/LICENSE
 */

import type { FGACheckContext, IFGAProvider } from './interfaces/fga';
import type { MastraFGAPermissionInput } from './interfaces/permissions.generated';

export interface CheckFGAOptions {
  fgaProvider: IFGAProvider | undefined;
  user: any;
  resource: { type: string; id: string };
  permission: MastraFGAPermissionInput;
  context?: FGACheckContext;
}

/**
 * Check fine-grained authorization for a resource.
 *
 * No-op if no FGA provider is configured (backward compatibility).
 * Delegates to fgaProvider.require() which throws FGADeniedError if denied.
 */
export async function checkFGA(options: CheckFGAOptions): Promise<void> {
  const { fgaProvider, user, resource, permission, context } = options;

  if (!fgaProvider) {
    return;
  }

  await fgaProvider.require(user, { resource, permission, context });
}

/**
 * Error thrown when an FGA authorization check is denied.
 */
export class FGADeniedError extends Error {
  public readonly user: any;
  public readonly resource: { type: string; id: string };
  public readonly permission: MastraFGAPermissionInput;
  public readonly status: number;

  constructor(user: any, resource: { type: string; id: string }, permission: MastraFGAPermissionInput) {
    const userId = user?.id || user?.workosId || 'unknown';
    super(`FGA authorization denied: user ${userId} cannot ${permission} on ${resource.type}:${resource.id}`);
    this.name = 'FGADeniedError';
    this.user = user;
    this.resource = resource;
    this.permission = permission;
    this.status = 403;
  }
}
