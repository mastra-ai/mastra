/**
 * Auth configuration for the example agent.
 *
 * This sets up Better Auth with email/password authentication
 * and integrates it with Mastra using the EE auth provider.
 */

import { MastraAuthBetterAuth } from '@mastra/auth-better-auth';
import { betterAuth } from 'better-auth';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';

// Use absolute path to ensure database is found regardless of working directory
const dbPath = join(import.meta.dirname, '../../database.sqlite');

export const auth = betterAuth({
  database: new DatabaseSync(dbPath),
  emailAndPassword: {
    enabled: true,
  },
});
/**
 * Mastra auth provider using Better Auth.
 *
 * This implements IUserProvider for EE user awareness in Studio.
 * License check happens in buildCapabilities() when calling /api/auth/capabilities.
 */
export const mastraAuth = new MastraAuthBetterAuth({
  auth,
});
