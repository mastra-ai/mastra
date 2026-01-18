/**
 * @mastra/auth-better-auth
 *
 * Self-hosted authentication provider using Better Auth
 *
 * @example
 * ```ts
 * import { MastraAuthBetterAuth } from '@mastra/auth-better-auth';
 *
 * const auth = new MastraAuthBetterAuth({
 *   database: {
 *     provider: 'postgresql',
 *     url: process.env.DATABASE_URL,
 *   },
 *   secret: process.env.AUTH_SECRET,
 *   baseURL: process.env.BASE_URL,
 *   emailAndPassword: {
 *     enabled: true,
 *   },
 * });
 * ```
 */

// Export types
export type { BetterAuthConfig, BetterAuthUser } from './types.js';

// Provider will be exported in Task 027
// export { MastraAuthBetterAuth } from './provider.js';
