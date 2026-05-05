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
 * `undefined`, no link-time error. We then expose a permission map that
 * defaults to an empty object on older cores, so property access like
 * `MastraFGAPermissions.AGENTS_READ` yields `undefined` instead of throwing.
 *
 * This is safe because:
 * - The permission constants are pure metadata used to label routes for
 *   FGA enforcement.
 * - All runtime FGA checks are gated behind `if (fgaProvider && user)`.
 *   A user on `@mastra/core < 1.32.0` cannot have a working FGA provider
 *   configured, so those branches never run.
 * - The route-config fields (`requiresPermission`, `fga`) did not exist
 *   on the route type in `@mastra/core < 1.32.0`, so nothing in that
 *   version reads them either.
 *
 * Once the consuming `@mastra/core` is on `1.32.0+` the values are real
 * and behaviour is identical to a direct named import.
 */

import * as authEE from '@mastra/core/auth/ee';

// Typed as `any` on purpose: consumers of `@mastra/server` may run their
// typecheck against a `@mastra/core` that doesn't export `MastraFGAPermissions`
// (anything < 1.32.0). Pinning to the real type would push that name into the
// emitted `.d.ts` and break downstream typecheck. `any` lets the property
// accesses (`MastraFGAPermissions.AGENTS_READ`) flow through cleanly on every
// supported core.
export const MastraFGAPermissions: any = (authEE as any).MastraFGAPermissions ?? {};
