/**
 * General-purpose integration reauth error detection.
 *
 * The factory server returns a standard wire shape when any integration's
 * upstream authorization is dead:
 *
 * ```json
 * {
 *   "error": "integration_reauth_required",
 *   "integration": "linear",
 *   "connectPath": "/auth/linear/connect",
 *   "message": "Linear authorization expired. Reconnect to continue."
 * }
 * ```
 *
 * This module provides a single check that works for any integration so the
 * SPA doesn't need per-integration error matchers.
 */

export interface IntegrationReauthInfo {
  /** The integration that needs reconnection (e.g. `'linear'`). */
  integration: string;
  /** Server-relative path to start the OAuth connect flow. */
  connectPath: string;
  /** Human-readable message from the server. */
  message: string;
}

/**
 * Extract reauth info from a fetch error, or return `null` when the error
 * is not a reauth error.
 *
 * Works with errors thrown by `getLinearResource` and any similar fetch
 * helper that stores the parsed response `error` field as `err.code`.
 */
export function getIntegrationReauthInfo(err: unknown): IntegrationReauthInfo | null {
  const coded = err as { code?: string; message?: string; connectPath?: string; integration?: string } | null;
  if (coded?.code !== 'integration_reauth_required') return null;
  return {
    integration: coded.integration ?? 'unknown',
    connectPath: coded.connectPath ?? '',
    message: coded.message ?? 'Authorization expired. Reconnect to continue.',
  };
}

/**
 * True when the error is an integration reauth error for any integration.
 * Shorthand for `getIntegrationReauthInfo(err) !== null`.
 */
export function isIntegrationReauthError(err: unknown): boolean {
  return getIntegrationReauthInfo(err) !== null;
}
