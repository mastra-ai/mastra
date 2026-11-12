/**
 * Authenticated end user, normalized to a stable shape.
 *
 * Produced by `MastraAuthProvider.toMastraUser()` at authentication time and
 * surfaced to `DynamicArgument` callbacks as the optional `user` argument:
 *
 * @example
 * ```typescript
 * const agent = new Agent({
 *   instructions: ({ user }) =>
 *     user ? `You are helping ${user.name ?? user.id}.` : 'You are a helpful assistant.',
 * });
 * ```
 *
 * All fields except `id` are optional — availability depends on the
 * configured auth provider. The raw provider-specific user object remains
 * available on the request context under the `mastra__user` key.
 */
export type { MastraUser } from '@internal/auth';
