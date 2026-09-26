import type { RequestContext } from '@mastra/core/request-context';

import { getFactoryAuthUserFromContext, getFactoryAuthUserId } from '../auth.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import { parseSupervisorResourceId } from '../supervisor/session.js';
import { canAccessFactorySession } from '../workspace.js';
import type { SourceControlSessionLookup } from './factory-session.js';

/**
 * Whether the signed-in caller may act as the Factory session that owns
 * `resourceId`: a supervisor session when the caller's org owns its project,
 * otherwise a source-control session under the rule that gates opening its
 * workspace.
 */
export async function canCallerActAsFactorySession(
  lookups: {
    sessions?: Pick<SourceControlSessionLookup, 'getBySessionId'>;
    projects?: Pick<FactoryProjectsStorage, 'get'>;
  },
  resourceId: string,
  requestContext: RequestContext,
): Promise<boolean> {
  const user = getFactoryAuthUserFromContext(requestContext);
  const userId = getFactoryAuthUserId(user);
  if (!user?.organizationId || !userId) return false;
  // A failed lookup (storage error, ambiguous providers) denies instead of
  // failing the caller's run from inside an authorization check.
  try {
    const factoryProjectId = parseSupervisorResourceId(resourceId);
    if (factoryProjectId) {
      return !!(await lookups.projects?.get({ orgId: user.organizationId, id: factoryProjectId }));
    }
    const session = await lookups.sessions?.getBySessionId(resourceId);
    return !!session && canAccessFactorySession(session, user.organizationId, userId);
  } catch (error) {
    // Logged because the denial is otherwise indistinguishable from a real
    // one: the caller just sees main's thread-ownership error.
    console.warn('[Factory] Session resource lookup failed; denying mapped caller', {
      resourceId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
