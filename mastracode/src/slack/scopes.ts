/**
 * Slack permission levels and their user-token scope presets.
 *
 * These presets are the scopes mastracode requests when running the PKCE
 * OAuth flow against the Mastra-published Slack app. Every scope listed here
 * MUST also be declared in `slack-app-manifest.json` (the app's granted
 * superset) — `SLACK_MANIFEST_USER_SCOPES` below mirrors that manifest and a
 * unit test asserts each preset is a subset of it.
 */

/** Permission level chosen by the user; controls which scopes are requested. */
export type SlackPermissionLevel = 'read-only' | 'read-write' | 'full';

/** All permission levels, ordered from least to most privileged. */
export const SLACK_PERMISSION_LEVELS: readonly SlackPermissionLevel[] = ['read-only', 'read-write', 'full'] as const;

/** The default permission level for a fresh connection. */
export const DEFAULT_SLACK_PERMISSION_LEVEL: SlackPermissionLevel = 'read-only';

const READ_ONLY_SCOPES = [
  'search:read.public',
  'search:read.private',
  'channels:history',
  'groups:history',
  'im:history',
  'mpim:history',
  'users:read',
  'users:read.email',
  'canvases:read',
] as const;

const READ_WRITE_EXTRA_SCOPES = ['chat:write', 'reactions:write', 'canvases:write'] as const;

const FULL_EXTRA_SCOPES = ['channels:read', 'groups:read', 'channels:write', 'groups:write'] as const;

const READ_WRITE_SCOPES = [...READ_ONLY_SCOPES, ...READ_WRITE_EXTRA_SCOPES] as const;

const FULL_SCOPES = [...READ_WRITE_SCOPES, ...FULL_EXTRA_SCOPES] as const;

/** Map from permission level to the exact set of user-token scopes to request. */
const SCOPE_PRESETS: Record<SlackPermissionLevel, readonly string[]> = {
  'read-only': READ_ONLY_SCOPES,
  'read-write': READ_WRITE_SCOPES,
  full: FULL_SCOPES,
};

/**
 * Superset of user-token scopes declared in the Slack app manifest. Kept in
 * sync with `slack-app-manifest.json`. Every preset scope must appear here.
 */
export const SLACK_MANIFEST_USER_SCOPES: readonly string[] = [...FULL_SCOPES] as const;

/** Return the user-token scopes to request for a given permission level. */
export function scopesForLevel(level: SlackPermissionLevel): string[] {
  return [...SCOPE_PRESETS[level]];
}

/** Type guard for a valid permission level string. */
export function isSlackPermissionLevel(value: unknown): value is SlackPermissionLevel {
  return typeof value === 'string' && (SLACK_PERMISSION_LEVELS as readonly string[]).includes(value);
}
