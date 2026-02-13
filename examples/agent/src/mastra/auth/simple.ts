/**
 * SimpleAuth provider - Token-based authentication for development/testing.
 * Maps tokens to users for simple API key authentication.
 */

import { StaticRBACProvider, DEFAULT_ROLES } from '@mastra/core/ee';
import type { EEUser } from '@mastra/core/ee';
import { SimpleAuth } from '@mastra/core/server';

import type { AuthResult } from './types';

export function initSimpleAuth(): AuthResult {
  const mastraAuth = new SimpleAuth<EEUser>({
    tokens: {
      'test-token': {
        id: 'user-1',
        email: 'admin@example.com',
        name: 'Admin User',
      },
      'viewer-token': {
        id: 'user-2',
        email: 'viewer@example.com',
        name: 'Viewer User',
      },
    },
  });

  const rbacProvider = new StaticRBACProvider<EEUser>({
    roles: DEFAULT_ROLES,
    getUserRoles: (user: EEUser) => {
      const adminEmails = ['admin@example.com', 'owner@example.com'];
      if (user.email && adminEmails.includes(user.email)) {
        return ['admin'];
      }
      return ['viewer'];
    },
  });

  console.log('[Auth] Using SimpleAuth (token-based) authentication');
  return { mastraAuth, rbacProvider };
}
