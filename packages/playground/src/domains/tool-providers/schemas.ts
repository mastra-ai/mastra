import { z } from 'zod';

/**
 * Shared form schemas for `toolProviders`. The Agent Builder mounts these
 * on its top-level form schema so save/load can round-trip through the
 * stored agent shape.
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
    label: z.string().max(LABEL_MAX_LEN).regex(LABEL_REGEX).optional().or(z.literal('')),
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
 * Shared `superRefine` helper. Hosts call this from their top-level schema's
 * refinement so they can scope `path` correctly.
 */
export function validateToolProviders(
  providers: ToolProvidersFormValue | undefined,
  ctx: z.RefinementCtx,
  basePath: (string | number)[] = ['toolProviders'],
): void {
  if (!providers) return;

  for (const [providerId, config] of Object.entries(providers)) {
    for (const [toolkit, connections] of Object.entries(config.connections ?? {})) {
      const seenLabels = new Map<string, number>();
      const seenConnectionIds = new Map<string, number>();
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
