/**
 * Better Auth provider - Credentials-based authentication with SQLite.
 */

import { StaticRBACProvider, DEFAULT_ROLES } from '@mastra/core/ee';
import type { EEUser } from '@mastra/core/ee';

import type { AuthResult } from './types';

export async function initBetterAuth(): Promise<AuthResult> {
  const { MastraAuthBetterAuth } = await import('@mastra/auth-better-auth');
  const { betterAuth } = await import('better-auth');
  const { getMigrations } = await import('better-auth/db');
  // Use Node.js built-in SQLite (available since Node 22.5.0)
  const { DatabaseSync } = await import('node:sqlite');
  const { join } = await import('node:path');

  const dbPath = join(import.meta.dirname, '../../../database.sqlite');

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
      return ['viewer'];
    },
  });

  console.log('[Auth] Using Better Auth authentication');
  return { mastraAuth, rbacProvider, auth };
}
