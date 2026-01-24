import type { MastraAdmin, Team, TeamMember, TeamRole } from '@mastra/admin';
import type { Context, Next } from 'hono';

/**
 * Team context middleware configuration.
 */
export interface TeamContextMiddlewareConfig {
  /**
   * Allow team context from header (X-Team-Id).
   * Default: true
   */
  allowHeader?: boolean;

  /**
   * Allow team context from query param (?teamId=...).
   * Default: true
   */
  allowQuery?: boolean;
}

/**
 * Create team context middleware.
 *
 * This middleware extracts and validates team context from requests.
 * Team context can come from:
 * 1. Route params (/teams/:teamId/...)
 * 2. Header (X-Team-Id)
 * 3. Query param (?teamId=...)
 *
 * It verifies that the authenticated user is a member of the team.
 *
 * Note: This is complementary to RBAC middleware. Use this when you need
 * explicit team context validation beyond what RBAC provides.
 *
 * @example
 * ```typescript
 * const teamMiddleware = createTeamContextMiddleware(admin);
 * app.use('/api/*', teamMiddleware);
 * ```
 */
export function createTeamContextMiddleware(admin: MastraAdmin, config?: TeamContextMiddlewareConfig) {
  const allowHeader = config?.allowHeader ?? true;
  const allowQuery = config?.allowQuery ?? true;

  return async (c: Context, next: Next) => {
    const userId = c.get('userId') as string | undefined;

    // If no user, skip (auth middleware will handle)
    if (!userId) {
      return next();
    }

    // Check if team context is already set by RBAC middleware
    const existingTeamId = c.get('teamId') as string | undefined;
    if (existingTeamId) {
      return next();
    }

    // Extract team ID from various sources
    let teamId: string | undefined = c.req.param('teamId');

    if (!teamId && allowHeader) {
      const headerTeamId = c.req.header('X-Team-Id');
      if (headerTeamId) {
        teamId = headerTeamId;
      }
    }

    if (!teamId && allowQuery) {
      const queryTeamId = c.req.query('teamId');
      if (queryTeamId) {
        teamId = queryTeamId;
      }
    }

    // If no team ID found, continue without team context
    if (!teamId) {
      return next();
    }

    const storage = admin.getStorage();

    try {
      // Verify user has access to team
      const membership = await storage.getTeamMember(teamId, userId);
      if (!membership) {
        return c.json({ error: 'Not a member of this team', code: 'FORBIDDEN' }, 403);
      }

      // Get team details
      const team = await storage.getTeam(teamId);
      if (!team) {
        return c.json({ error: 'Team not found', code: 'NOT_FOUND' }, 404);
      }

      // Set context
      c.set('team', team);
      c.set('teamId', teamId);
      c.set('teamRole', membership.role);
      c.set('teamMember', membership);
    } catch (error) {
      console.error('Team context middleware error:', error);
      return c.json({ error: 'Team not found', code: 'NOT_FOUND' }, 404);
    }

    return next();
  };
}

/**
 * Extended Hono variables interface for team context.
 */
export interface TeamContextVariables {
  team?: Team;
  teamId?: string;
  teamRole?: TeamRole;
  teamMember?: TeamMember;
}
