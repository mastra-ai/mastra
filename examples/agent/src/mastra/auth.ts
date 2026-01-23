/**
 * Auth configuration for the example agent.
 *
 * Supports three authentication providers:
 * - SimpleAuth: Token-based authentication for development/testing
 * - Better Auth: Credentials-based authentication with SQLite
 * - WorkOS: Enterprise SSO (SAML, OIDC)
 *
 * Set AUTH_PROVIDER to switch between providers.
 */

import { StaticRBACProvider, DEFAULT_ROLES } from '@mastra/core/ee';
import type { EEUser } from '@mastra/core/ee';
import { SimpleAuth, type MastraAuthProvider } from '@mastra/core/server';

// ===========================================================================
// Configuration
// ===========================================================================

type AuthProviderType = 'simple' | 'better-auth' | 'workos';

const AUTH_PROVIDER: AuthProviderType = (process.env.AUTH_PROVIDER as AuthProviderType) || 'simple';

// ===========================================================================
// Initialization Functions
// ===========================================================================

interface AuthResult {
  mastraAuth: MastraAuthProvider<EEUser>;
  rbacProvider: StaticRBACProvider<EEUser>;
  auth?: unknown; // Better Auth instance (only for better-auth provider)
}

/**
 * Initialize SimpleAuth with token-based authentication.
 * Maps tokens to users for simple API key authentication.
 */
function initSimpleAuth(): AuthResult {
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
      return ['admin']; // Demo: all users get admin role
    },
  });

  console.log('[Auth] Using SimpleAuth (token-based) authentication');
  return { mastraAuth, rbacProvider };
}

/**
 * Initialize Better Auth with credentials-based authentication.
 * Uses SQLite for user storage.
 */
async function initBetterAuth(): Promise<AuthResult> {
  const { MastraAuthBetterAuth } = await import('@mastra/auth-better-auth');
  const { betterAuth } = await import('better-auth');
  const { getMigrations } = await import('better-auth/db');
  // Use Node.js built-in SQLite (available since Node 22.5.0)
  // No native module compilation required
  const { DatabaseSync } = await import('node:sqlite');
  const { join } = await import('node:path');

  const dbPath = join(import.meta.dirname, '../../database.sqlite');

  const authConfig = {
    database: new DatabaseSync(dbPath),
    emailAndPassword: { enabled: true },
  };

  const auth = betterAuth(authConfig);

  // Auto-migrate database schema if needed
  const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(authConfig);
  if (toBeCreated.length > 0 || toBeAdded.length > 0) {
    console.log('[Auth] Running Better Auth migrations...');
    await runMigrations();
    console.log('[Auth] Migrations completed');
  }

  const mastraAuth = new MastraAuthBetterAuth({ auth });

  const rbacProvider = new StaticRBACProvider<EEUser>({
    roles: DEFAULT_ROLES,
    getUserRoles: (user: EEUser) => {
      const adminEmails = ['admin@example.com', 'owner@example.com'];
      if (user.email && adminEmails.includes(user.email)) {
        return ['admin'];
      }
      return ['admin'];
    },
  });

  console.log('[Auth] Using Better Auth authentication');
  return { mastraAuth, rbacProvider, auth };
}

/**
 * Initialize WorkOS with enterprise SSO support.
 * Requires WORKOS_API_KEY and WORKOS_CLIENT_ID environment variables.
 */
async function initWorkOS(): Promise<AuthResult> {
  const { MastraAuthWorkos, MastraRBACWorkos } = await import('@mastra/auth-workos');
  const { WorkOS } = await import('@workos-inc/node');

  const apiKey = process.env.WORKOS_API_KEY;
  const clientId = process.env.WORKOS_CLIENT_ID;

  if (!apiKey || !clientId) {
    console.warn('[Auth] WorkOS credentials not set, falling back to SimpleAuth');
    return initSimpleAuth();
  }

  const workosClient = new WorkOS(apiKey, { clientId });

  const mastraAuth = new MastraAuthWorkos({
    apiKey,
    clientId,
    redirectUri: process.env.WORKOS_REDIRECT_URI || 'http://localhost:4111/api/auth/callback',
  });

  const rbacProvider = new MastraRBACWorkos({
    workos: workosClient,
    roleMapping: {
      admin: ['*'],
      member: ['agents:read', 'agents:execute', 'workflows:read', 'workflows:execute', 'logs:read', 'audit:read'],
      viewer: ['agents:read', 'workflows:read', 'logs:read'],
      _default: ['agents:read'],
    },
  });

  console.log('[Auth] Using WorkOS authentication');
  return { mastraAuth, rbacProvider };
}

/**
 * Initialize the configured auth provider.
 */
async function initAuth(): Promise<AuthResult> {
  switch (AUTH_PROVIDER) {
    case 'simple':
      return initSimpleAuth();
    case 'better-auth':
      return initBetterAuth();
    case 'workos':
      return initWorkOS();
    default:
      console.warn(`[Auth] Unknown provider "${AUTH_PROVIDER}", falling back to SimpleAuth`);
      return initSimpleAuth();
  }
}

// ===========================================================================
// Exports
// ===========================================================================

const { mastraAuth, rbacProvider, auth } = await initAuth();

export { mastraAuth, rbacProvider, auth };
