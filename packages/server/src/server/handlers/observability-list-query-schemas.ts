import { z } from 'zod/v4';

/**
 * Server-local route-layer query schemas for observability list endpoints.
 *
 * Why these live in @mastra/server instead of importing the newer shared core
 * exports directly:
 * - `mode`, `after`, and `limit` were added after older @mastra/core versions
 *   that @mastra/server still needs to tolerate at runtime.
 * - Direct named imports of newly-added schema exports create module-link-time
 *   failures when a newer server is paired with an older core.
 * - These are route parsing concerns, so mirroring the current core schema
 *   semantics here keeps the server backward-compatible without forcing a peer
 *   dependency lockstep upgrade.
 *
 * TODO(Mastra 2.0): remove this shim and import the shared observability list
 * query schemas directly once server/core no longer need to tolerate older
 * mixed-version pairings.
 */

export const paginationArgsSchema = z
  .object({
    page: z.coerce.number().int().min(0).optional().default(0).describe('Zero-indexed page number'),
    perPage: z.coerce.number().int().min(1).max(100).optional().default(10).describe('Number of items per page'),
  })
  .describe('Pagination options for list queries');

export const deltaCursorSchema = z.string().min(1).describe('Opaque cursor value for incremental polling');

export const listModeSchema = z
  .enum(['page', 'delta'])
  .describe("List mode: 'page' | 'delta', defaults to 'page' when omitted.");

export const deltaLimitSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(100)
  .optional()
  .describe('Maximum number of updates to return in one delta poll');
