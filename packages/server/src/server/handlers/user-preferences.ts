/**
 * User preferences handlers.
 *
 * Per-user preferences (starred agents/skills, Agent Studio view settings, appearance)
 * are stored in the core user-preferences storage domain, keyed by the authenticated
 * user's id as reported by the auth provider. Anonymous requests are rejected.
 */

import type { IUserProvider } from '@mastra/core/auth';
import type { MastraAuthProvider } from '@mastra/core/server';
import type { StorageUserPreferencesType } from '@mastra/core/storage';

import { HTTPException } from '../http-exception';
import { userPreferencesResponseSchema, updateUserPreferencesBodySchema } from '../schemas/user-preferences';
import { createRoute } from '../server-adapter/routes/route-builder';
import { handleError } from './error';

function getAuthProvider(mastra: any): MastraAuthProvider | null {
  const serverConfig = mastra.getServer?.();
  if (!serverConfig?.auth) return null;
  if (typeof serverConfig.auth.authenticateToken === 'function') {
    return serverConfig.auth as MastraAuthProvider;
  }
  return null;
}

function implementsInterface<T>(auth: unknown, method: keyof T): auth is T {
  return auth !== null && typeof auth === 'object' && method in auth;
}

async function requireUserId(mastra: any, request: Request | undefined): Promise<string> {
  const auth = getAuthProvider(mastra);
  if (!auth || !implementsInterface<IUserProvider>(auth, 'getCurrentUser')) {
    throw new HTTPException(401, { message: 'Authentication required' });
  }
  if (!request) {
    throw new HTTPException(500, { message: 'Request context unavailable' });
  }
  const user = await auth.getCurrentUser(request);
  if (!user?.id) {
    throw new HTTPException(401, { message: 'Authentication required' });
  }
  return user.id;
}

function defaultPreferences(userId: string): StorageUserPreferencesType {
  const now = new Date();
  return {
    userId,
    agentStudio: {
      starredAgents: [],
      starredSkills: [],
      previewMode: false,
    },
    createdAt: now,
    updatedAt: now,
  };
}

// ============================================================================
// GET /user/preferences
// ============================================================================

export const GET_USER_PREFERENCES_ROUTE = createRoute({
  method: 'GET',
  path: '/user/preferences',
  responseType: 'json',
  responseSchema: userPreferencesResponseSchema,
  summary: 'Get current user preferences',
  description:
    'Returns the authenticated user preferences. If no record exists yet, a default preferences object is returned.',
  tags: ['User Preferences'],
  requiresAuth: true,
  handler: async ctx => {
    try {
      const { mastra, request } = ctx as any;
      const userId = await requireUserId(mastra, request);

      const storage = mastra.getStorage();
      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const store = await storage.getStore('userPreferences');
      if (!store) {
        return defaultPreferences(userId);
      }

      const prefs = await store.get(userId);
      return prefs ?? defaultPreferences(userId);
    } catch (error) {
      return handleError(error, 'Error getting user preferences');
    }
  },
});

// ============================================================================
// PATCH /user/preferences
// ============================================================================

export const UPDATE_USER_PREFERENCES_ROUTE = createRoute({
  method: 'PATCH',
  path: '/user/preferences',
  responseType: 'json',
  bodySchema: updateUserPreferencesBodySchema,
  responseSchema: userPreferencesResponseSchema,
  summary: 'Update current user preferences',
  description:
    'Partially updates the authenticated user preferences. Missing keys are preserved; arrays are replaced, not merged.',
  tags: ['User Preferences'],
  requiresAuth: true,
  handler: async ctx => {
    try {
      const { mastra, request, agentStudio } = ctx as any;
      const userId = await requireUserId(mastra, request);

      const storage = mastra.getStorage();
      if (!storage) {
        throw new HTTPException(500, { message: 'Storage is not configured' });
      }

      const store = await storage.getStore('userPreferences');
      if (!store) {
        throw new HTTPException(500, { message: 'User preferences storage is not available' });
      }

      return await store.update(userId, { agentStudio });
    } catch (error) {
      return handleError(error, 'Error updating user preferences');
    }
  },
});
