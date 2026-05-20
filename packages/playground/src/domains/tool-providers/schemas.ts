import { z } from 'zod';

/**
 * Shared form schemas for `toolProviders`. Hoisted from `agent-builder/schemas.ts`
 * so the CMS agent editor and the Agent Builder can both reuse the same shapes
 * without duplicating validation rules.
 *
 * `kind` is locked to `'author'` for v1. `scope` defaults to `'per-author'` at
 * the runtime layer when absent.
 */

const LABEL_REGEX = /^[A-Za-z0-9 _-]+$/;
const LABEL_MAX_LEN = 32;

export const connectionFormSchema = z
  .object({
    kind: z.literal('author'),
    toolkit: z.string().min(1),
    connectionId: z.string().min(1),
    /**
     * Optional in storage. The form still validates format when present
     * but only *requires* a label once ≥ 2 connections share a
     * `toolkit` (enforced via `validateToolProviders`).
     */
    label: z.string().max(LABEL_MAX_LEN).regex(LABEL_REGEX).optional().or(z.literal('')),
    /**
     * Per-pin scope. `'per-author'` (default) buckets under the author's
     * `authorId`. `'shared'` buckets under `SHARED_BUCKET_ID` so every
     * editor on this Mastra can resolve the same tool-provider account.
     * `'caller-supplied'` defers bucketing to the request-context
     * `MASTRA_RESOURCE_ID_KEY` at runtime (multi-tenant SaaS). Absent
     * on legacy rows; runtime treats undefined as `'per-author'`.
     */
    scope: z.enum(['shared', 'per-author', 'caller-supplied']).optional(),
  })
  .passthrough();

export const toolProviderConfigFormSchema = z
  .object({
    tools: z.record(
      z.string(),
      z
        .object({
          toolkit: z.string().min(1),
          description: z.string().optional(),
        })
        .passthrough(),
    ),
    connections: z.record(z.string(), z.array(connectionFormSchema)),
  })
  .passthrough();

export const toolProvidersFormSchema = z.record(z.string(), toolProviderConfigFormSchema);

export type ToolProvidersFormValue = z.infer<typeof toolProvidersFormSchema>;
export type ToolProviderConnectionFormValue = z.infer<typeof connectionFormSchema>;

/**
 * Shared `superRefine` helper. Hosts (agent-builder, CMS editor) call this from
 * their top-level schema's refinement so they can scope `path` correctly.
 *
 * @param providers the parsed `toolProviders` value (or undefined)
 * @param ctx          the host's `RefinementCtx`
 * @param basePath     prefix path segments (e.g. `['toolProviders']`) the host
 *                     uses to mount this value on its form
 */
export function validateToolProviders(
  providers: ToolProvidersFormValue | undefined,
  ctx: z.RefinementCtx,
  basePath: (string | number)[] = ['toolProviders'],
): void {
  if (!providers) return;

  for (const [providerId, config] of Object.entries(providers)) {
    // Label rules:
    //  - Single connection per toolkit: label is optional.
    //  - Two or more connections: every entry needs a non-empty,
    //    case-insensitively unique label.
    // connectionId duplicates would pin the same OAuth bucket twice, doubling LLM
    // surface area without adding capability — always block.
    for (const [toolkit, connections] of Object.entries(config.connections ?? {})) {
      const seenLabels = new Map<string, number>();
      const seenConnectionIds = new Map<string, number>();
      // Caller-supplied connections are runtime markers — label is ignored
      // and the connectionId is resolved per request. Don't require/dedup labels
      // and don't enforce connectionId uniqueness across caller-supplied rows.
      const nonCallerSupplied = connections.filter(c => c.scope !== 'caller-supplied');
      const requireLabels = nonCallerSupplied.length >= 2;
      connections.forEach((connection, index) => {
        if (connection.scope === 'caller-supplied') return;
        const trimmed = connection.label?.trim() ?? '';

        if (requireLabels && trimmed.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Connection label is required on ${toolkit} when there are two or more connections`,
            path: [...basePath, providerId, 'connections', toolkit, index, 'label'],
          });
        } else if (requireLabels) {
          const labelKey = trimmed.toLowerCase();
          if (seenLabels.has(labelKey)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Duplicate label "${connection.label}" on ${toolkit} (case-insensitive)`,
              path: [...basePath, providerId, 'connections', toolkit, index, 'label'],
            });
          } else {
            seenLabels.set(labelKey, index);
          }
        }

        if (seenConnectionIds.has(connection.connectionId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Connection "${connection.connectionId}" is already pinned to ${toolkit}`,
            path: [...basePath, providerId, 'connections', toolkit, index, 'connectionId'],
          });
        } else {
          seenConnectionIds.set(connection.connectionId, index);
        }
      });
    }

    // Every selected tool must have at least one connection on its toolkit.
    for (const [slug, meta] of Object.entries(config.tools ?? {})) {
      const bucket = config.connections?.[meta.toolkit] ?? [];
      if (bucket.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Tool "${slug}" requires at least one connection for ${meta.toolkit}`,
          path: [...basePath, providerId, 'tools', slug],
        });
      }
    }
  }
}
