/**
 * @mastra/auth-cloud
 *
 * Zero-configuration authentication provider for Mastra Cloud
 *
 * Works out of the box with no configuration required. Provides SSO,
 * session management, and RBAC powered by Mastra Cloud's hosted service.
 *
 * @example
 * ```ts
 * import { MastraAuthCloud } from '@mastra/auth-cloud';
 *
 * // Zero config - works immediately
 * const auth = new MastraAuthCloud();
 *
 * // Custom configuration
 * const auth = new MastraAuthCloud({
 *   apiKey: process.env.MASTRA_CLOUD_API_KEY,
 *   endpoint: 'https://api.mastra.cloud',
 * });
 *
 * // Use in Mastra
 * const mastra = new Mastra({
 *   auth,
 * });
 * ```
 */

// Export types
export type { CloudAuthConfig, CloudUser } from './types.js';

// Export provider as default and named export
export { MastraAuthCloud } from './provider.js';
export { MastraAuthCloud as default } from './provider.js';
