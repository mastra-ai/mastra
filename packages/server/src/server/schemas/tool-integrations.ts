import { z } from 'zod/v4';

/**
 * Zod schemas for the Agent Builder tool integrations storage shape.
 *
 * Shipped alongside the legacy `mcpClientToolsConfigSchema` in
 * `stored-agents.ts` / `agent-versions.ts`. The legacy schema is
 * deprecated and removed in a future major release.
 *
 * Rules:
 *  - **Additive-only.** No version field. Future fields are introduced
 *    as optional and existing fields are never removed in v1.x.
 *  - `label` is required, ≤ 32 chars, `[A-Za-z0-9 _-]+`.
 *  - `label` is **case-insensitively unique** within
 *    `connections[toolService]`.
 *  - `kind` accepts all three values for forward-compat; v1 only writes
 *    `'author'`.
 */

const labelSchema = z
  .string()
  .min(1, 'Connection label is required')
  .max(32, 'Connection label must be ≤ 32 characters')
  .regex(/^[A-Za-z0-9 _-]+$/, 'Connection label may only contain letters, digits, spaces, _ and -');

/**
 * One OAuth bucket bound to one tool service on one agent.
 */
export const connectionSchema = z.object({
  kind: z.enum(['author', 'invoker', 'platform']),
  toolService: z.string().min(1),
  connectionId: z.string(),
  label: labelSchema,
});

const toolMetaSchema = z.object({
  description: z.string().optional(),
});

/**
 * Stored shape for one integration's configuration on one agent.
 *
 * `superRefine` enforces case-insensitive uniqueness of `label` within
 * each `connections[toolService]` array.
 */
export const toolIntegrationConfigSchema = z
  .object({
    tools: z.record(z.string(), toolMetaSchema),
    connections: z.record(z.string(), z.array(connectionSchema)),
  })
  .superRefine((value, ctx) => {
    for (const [toolService, connections] of Object.entries(value.connections)) {
      const seen = new Map<string, number>(); // lowercased label -> first index
      for (let i = 0; i < connections.length; i++) {
        const conn = connections[i]!;
        const key = conn.label.toLocaleLowerCase();
        const prevIndex = seen.get(key);
        if (prevIndex !== undefined) {
          ctx.addIssue({
            code: 'custom',
            path: ['connections', toolService, i, 'label'],
            message: `Duplicate connection label "${conn.label}" on toolService "${toolService}" (labels must be unique case-insensitively)`,
          });
        } else {
          seen.set(key, i);
        }
      }
    }
  });

/**
 * Full v1 tool integrations payload: keyed by integration id.
 */
export const toolIntegrationsSchema = z.record(z.string(), toolIntegrationConfigSchema);
