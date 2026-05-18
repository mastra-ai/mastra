/**
 * Safe re-export of `computeNextFireAt` from `@mastra/core/workflows`.
 *
 * Why this shim exists:
 * `computeNextFireAt` was introduced in `@mastra/core@1.32.0`. Earlier
 * versions of `@mastra/core` ship `@mastra/core/workflows` but do not export
 * this function. A direct named import fails at ESM link time when this
 * version of `@mastra/server` is paired with `@mastra/core < 1.32.0`, taking
 * the entire user bundle down before any code runs.
 *
 * A namespace import tolerates missing names. We expose the real function
 * when available and fall back to a function that throws a clear error
 * otherwise — schedules require new-core support anyway, so loud failure at
 * the call site is far better than silent corruption.
 *
 * Typed as `any` on purpose (see ./observability-storage-schemas.ts for
 * the same rationale): keeps the emitted `.d.ts` free of names that don't
 * exist in older cores.
 */

import * as coreWorkflows from '@mastra/core/workflows';

const exported = (coreWorkflows as Record<string, unknown>).computeNextFireAt;

export const computeNextFireAt: any =
  exported ??
  (() => {
    throw new Error(
      '`computeNextFireAt` is not available in this version of @mastra/core. ' +
        'Schedules require @mastra/core >= 1.32.0.',
    );
  });
