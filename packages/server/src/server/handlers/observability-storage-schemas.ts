/**
 * Safe re-export of branches-related Zod schemas from `@mastra/core/storage`.
 *
 * Why this shim exists:
 * The `branches*` and `getBranch*` / `listBranches*` schemas (used to define
 * `/observability/branches` and `/observability/traces/:traceId/branches/:spanId`
 * routes) were introduced in `@mastra/core@1.32.0`. Earlier versions of
 * `@mastra/core` ship `@mastra/core/storage` but do not export these names.
 *
 * A direct named import (`import { branchesFilterSchema } from
 * '@mastra/core/storage'`) fails at ESM link time when this version of
 * `@mastra/server` is paired with `@mastra/core < 1.32.0`, taking the entire
 * user bundle down before any code runs.
 *
 * A namespace import tolerates missing names (`ns.MissingExport` is just
 * `undefined`, no link-time error). We then fall back to a permissive empty
 * `z.object({})` so the route definitions can still evaluate at module load
 * time. On old core the branches routes will register but their handlers
 * will fail at request time when the storage backend doesn't implement
 * `listBranches` / `getBranch` — which is the correct degradation, since
 * those storage methods don't exist on old core either.
 *
 * Once the consuming `@mastra/core` is on `1.32.0+` the schemas are real
 * and behaviour is identical to a direct named import.
 */

import * as coreStorage from '@mastra/core/storage';
import { z } from 'zod/v4';

// Each export is typed as `any` on purpose: consumers of `@mastra/server` may
// run their typecheck against a `@mastra/core` that doesn't export these names
// (anything < 1.32.0). Pinning to the real types would push those names into
// the emitted `.d.ts` and break downstream typecheck. `any` lets the schema
// chains (`.extend(...)`, `.pick(...)`, `.partial()`) flow through cleanly on
// every supported core.
//
// Runtime behaviour:
//  - On `@mastra/core >= 1.32.0` the real Zod schemas are re-exported.
//  - On older cores, fallbacks are used: `z.object({})` for object schemas
//    (still supports `.extend`, `.pick`, `.partial`) and `z.unknown()` for
//    response schemas. The branches/getBranch routes will register but their
//    handlers will fail at request time when the storage backend doesn't
//    implement `listBranches` / `getBranch` — the correct degradation, since
//    those methods don't exist on old core either.
const ns = coreStorage as Record<string, unknown>;
const fallbackEmptyObject = z.object({});
// `getBranchArgsSchema` is `.pick()`ed at module-eval time; the empty fallback
// would crash because the picked keys aren't declared. Pre-declare them as
// permissive `z.unknown()` so the route definitions evaluate cleanly.
const fallbackBranchArgs = z.object({
  traceId: z.unknown(),
  spanId: z.unknown(),
  depth: z.unknown(),
});
const fallbackSchema = z.unknown();

export const branchesFilterSchema: any = ns.branchesFilterSchema ?? fallbackEmptyObject;
export const branchesOrderBySchema: any = ns.branchesOrderBySchema ?? fallbackEmptyObject;
export const getBranchArgsSchema: any = ns.getBranchArgsSchema ?? fallbackBranchArgs;
export const listBranchesResponseSchema: any = ns.listBranchesResponseSchema ?? fallbackSchema;
export const getBranchResponseSchema: any = ns.getBranchResponseSchema ?? fallbackSchema;
