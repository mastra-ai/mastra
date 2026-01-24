import type { MastraAdmin, Team, TeamMember, Permission } from '@mastra/admin';
import type { Context, Next } from 'hono';

/**
 * RBAC middleware configuration.
 */
export interface RBACMiddlewareConfig {
  /**
   * Map route patterns to required permissions.
   * If a route matches a pattern, the corresponding permission is required.
   */
  permissions?: Map<string, Permission>;
}

/**
 * Create RBAC middleware.
 *
 * This middleware:
 * 1. Extracts resource IDs (teamId, projectId, deploymentId, buildId, serverId) from path params
 * 2. Resolves team context from various ID types
 * 3. Loads team membership and permissions
 * 4. Sets team, teamId, teamMember, and permissions in context
 *
 * Note: Most permission checks are done within route handlers (calling admin methods).
 * This middleware handles cross-cutting concerns like team context resolution.
 *
 * @example
 * ```typescript
 * const rbacMiddleware = createRBACMiddleware(admin);
 * app.use('/api/*', rbacMiddleware);
 * ```
 */
export function createRBACMiddleware(admin: MastraAdmin, _config?: RBACMiddlewareConfig) {
  return async (c: Context, next: Next) => {
    const userId = c.get('userId') as string | undefined;

    if (!userId) {
      // No user context, skip RBAC (auth middleware will handle)
      return next();
    }

    // Extract IDs from path params
    const teamId = c.req.param('teamId');
    const projectId = c.req.param('projectId');
    const deploymentId = c.req.param('deploymentId');
    const buildId = c.req.param('buildId');
    const serverId = c.req.param('serverId');

    // Resolve team context from various ID types
    let resolvedTeamId: string | undefined = teamId;

    const storage = admin.getStorage();

    // Resolve from projectId
    if (!resolvedTeamId && projectId) {
      try {
        const project = await storage.getProject(projectId);
        resolvedTeamId = project?.teamId;
      } catch {
        // Project not found, will be handled in handler
      }
    }

    // Resolve from deploymentId
    if (!resolvedTeamId && deploymentId) {
      try {
        const deployment = await storage.getDeployment(deploymentId);
        if (deployment) {
          const project = await storage.getProject(deployment.projectId);
          resolvedTeamId = project?.teamId;
        }
      } catch {
        // Deployment not found, will be handled in handler
      }
    }

    // Resolve from buildId
    if (!resolvedTeamId && buildId) {
      try {
        const build = await storage.getBuild(buildId);
        if (build) {
          const deployment = await storage.getDeployment(build.deploymentId);
          if (deployment) {
            const project = await storage.getProject(deployment.projectId);
            resolvedTeamId = project?.teamId;
          }
        }
      } catch {
        // Build not found, will be handled in handler
      }
    }

    // Resolve from serverId
    if (!resolvedTeamId && serverId) {
      try {
        const server = await storage.getRunningServer(serverId);
        if (server) {
          const deployment = await storage.getDeployment(server.deploymentId);
          if (deployment) {
            const project = await storage.getProject(deployment.projectId);
            resolvedTeamId = project?.teamId;
          }
        }
      } catch {
        // Server not found, will be handled in handler
      }
    }

    // If we have a team context, load team info and permissions
    if (resolvedTeamId) {
      try {
        const [team, member, permissions] = await Promise.all([
          storage.getTeam(resolvedTeamId),
          storage.getTeamMember(resolvedTeamId, userId),
          admin.getRBAC().getUserPermissions(userId, resolvedTeamId),
        ]);

        // Set context variables
        c.set('team', team);
        c.set('teamId', resolvedTeamId);
        c.set('teamMember', member);
        c.set('permissions', permissions);
      } catch {
        // Team context resolution failed, will be handled in handler
      }
    }

    return next();
  };
}

/**
 * Extended Hono variables interface for type safety.
 * Add this to your Hono app's Variables type.
 */
export interface RBACVariables {
  team?: Team;
  teamId?: string;
  teamMember?: TeamMember;
  permissions: Permission[];
}
