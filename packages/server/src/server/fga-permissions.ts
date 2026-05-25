/**
 * Safe re-export of `MastraFGAPermissions` from `@mastra/core/auth/ee`.
 *
 * Why this shim exists:
 * `MastraFGAPermissions` was introduced in `@mastra/core@1.32.0`. Earlier
 * versions of `@mastra/core` ship `@mastra/core/auth/ee` but do not export
 * this constant. A direct named import (`import { MastraFGAPermissions }
 * from '@mastra/core/auth/ee'`) fails at ESM link time when this version
 * of `@mastra/server` is paired with `@mastra/core < 1.32.0`, taking the
 * entire user bundle down before any code runs.
 *
 * A namespace import tolerates missing names — `ns.MissingExport` is just
 * `undefined`, no link-time error. We then expose the permission map.
 *
 * Fallback values:
 * If the consuming `@mastra/core` does not export `MastraFGAPermissions`,
 * we substitute a hardcoded map of the canonical permission strings used
 * by routes in `@mastra/server`. This preserves the explicit RBAC
 * permission overrides those routes already had as string literals in
 * `@mastra/server@1.31.0` (e.g. `requiresPermission: "agents:execute"`
 * on `/v1/responses`). Without this fallback, `requiresPermission` would
 * be `undefined` on old core and the auth layer would derive the wrong
 * permission from the route path (e.g. `v1:write` instead of
 * `agents:execute`), breaking RBAC users who upgrade `@mastra/server`
 * but stay on `@mastra/core@1.31.0`.
 *
 * Once the consuming `@mastra/core` is on `1.32.0+` the values are real
 * and behaviour is identical to a direct named import.
 */

import * as authEE from '@mastra/core/auth/ee';

// Canonical strings for the FGA permission keys actually referenced by
// `@mastra/server` source. Mirrors `MastraFGAPermissions` in
// `@mastra/core@1.32.0+` for these specific keys, and matches the string
// literals previously hardcoded on the same routes in `@mastra/server@1.31.0`.
const FALLBACK_PERMISSIONS = {
  AGENTS_CREATE: 'agents:create',
  AGENTS_DELETE: 'agents:delete',
  AGENTS_EXECUTE: 'agents:execute',
  AGENTS_READ: 'agents:read',
  MEMORY_DELETE: 'memory:delete',
  MEMORY_READ: 'memory:read',
  MEMORY_WRITE: 'memory:write',
  TOOLS_EXECUTE: 'tools:execute',
  TOOLS_READ: 'tools:read',
  WORKFLOWS_EXECUTE: 'workflows:execute',
  WORKFLOWS_READ: 'workflows:read',
} as const;

const realPermissions = (authEE as any).MastraFGAPermissions;

// Typed as `any` on purpose: consumers of `@mastra/server` may run their
// typecheck against a `@mastra/core` that doesn't export `MastraFGAPermissions`
// (anything < 1.32.0). Pinning to the real type would push that name into the
// emitted `.d.ts` and break downstream typecheck. `any` lets the property
// accesses (`MastraFGAPermissions.AGENTS_READ`) flow through cleanly on every
// supported core.
export const MastraFGAPermissions: any =
  realPermissions && Object.keys(realPermissions).length > 0 ? realPermissions : FALLBACK_PERMISSIONS;
