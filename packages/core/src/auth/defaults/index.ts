/**
 * Default implementations for authentication.
 * For EE defaults (roles, RBAC providers), see `@mastra/core/auth/ee`.
 */

// Session providers
export { MemorySessionProvider, type MemorySessionProviderOptions } from './session';
export { CookieSessionProvider, type CookieSessionProviderOptions } from './session';
