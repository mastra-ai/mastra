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
 *  - `label` is optional when there is exactly one connection for a
 *    `toolService`. Once two or more connections share a `toolService`,
 *    every connection must carry a non-empty, ≤ 32 char,
 *    `[A-Za-z0-9 _-]+` label that is case-insensitively unique within
 *    that service.
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
  label: labelSchema.optional(),
});

const toolMetaSchema = z.object({
  toolService: z.string().min(1).optional(),
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
      // Single connection per service: label is optional, skip both checks.
      if (connections.length < 2) continue;

      const seen = new Map<string, number>(); // lowercased label -> first index
      for (let i = 0; i < connections.length; i++) {
        const conn = connections[i]!;
        const trimmed = conn.label?.trim() ?? '';
        if (trimmed.length === 0) {
          ctx.addIssue({
            code: 'custom',
            path: ['connections', toolService, i, 'label'],
            message: `Connection label is required on toolService "${toolService}" once it has two or more connections`,
          });
          continue;
        }
        const key = trimmed.toLocaleLowerCase();
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

// ============================================================================
// HTTP route schemas — /api/tool-integrations/*
// ============================================================================

// Path Parameter Schemas

export const toolIntegrationIdPathParams = z.object({
  integrationId: z.string().describe('Unique identifier for the tool integration'),
});

export const toolIntegrationAuthStatusPathParams = toolIntegrationIdPathParams.extend({
  authId: z.string().describe('Opaque auth handle returned by authorize'),
});

// Query Parameter Schemas

export const listToolIntegrationToolsQuerySchema = z.object({
  toolService: z.string().optional().describe('Filter tools by tool service slug'),
  search: z.string().optional().describe('Search tools by name or description'),
  page: z.coerce.number().optional().describe('Page number for pagination (1-indexed)'),
  perPage: z.coerce.number().optional().describe('Number of items per page'),
});

// Body Schemas

export const authorizeToolIntegrationBodySchema = z.object({
  toolService: z.string().describe('Tool service slug being authorized'),
  connectionId: z.string().describe('Existing or newly-minted connection bucket id'),
  toolName: z.string().optional().describe('Optional tool slug for tool-scoped authorization'),
  config: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Provider-specific user-supplied connection fields (e.g. subdomain)'),
});

export const listConnectionFieldsQuerySchema = z.object({
  toolService: z.string().describe('Tool service slug whose connection field schema to list'),
});

export const connectionStatusToolIntegrationBodySchema = z.object({
  items: z
    .array(
      z.object({
        connectionId: z.string(),
        toolService: z.string(),
      }),
    )
    .describe('Connection tuples to batch-check'),
});

export const listConnectionsQuerySchema = z.object({
  toolService: z.string().describe('Tool service slug whose connections to list'),
});

// Response Schemas

const capabilitiesSchema = z.object({
  multipleConnectionsPerService: z.boolean(),
  batchConnectionStatus: z.boolean(),
  reauthorizeReusesConnectionId: z.boolean(),
});

export const listToolIntegrationsResponseSchema = z.object({
  integrations: z.array(
    z.object({
      id: z.string(),
      displayName: z.string(),
      capabilities: capabilitiesSchema,
    }),
  ),
});

export const listToolServicesResponseSchema = z.object({
  data: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      description: z.string().optional(),
      icon: z.string().optional(),
    }),
  ),
});

export const listToolIntegrationToolsResponseSchema = z.object({
  data: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      description: z.string().optional(),
      toolService: z.string(),
    }),
  ),
  pagination: z.object({
    page: z.number(),
    perPage: z.number().optional(),
    hasMore: z.boolean(),
  }),
});

export const authorizeToolIntegrationResponseSchema = z.object({
  url: z.string(),
  authId: z.string(),
});

export const authStatusToolIntegrationResponseSchema = z.object({
  status: z.enum(['pending', 'completed', 'failed']),
});

export const connectionStatusToolIntegrationResponseSchema = z.object({
  items: z.record(z.string(), z.object({ connected: z.boolean() })),
});

export const listConnectionsResponseSchema = z.object({
  items: z.array(
    z.object({
      connectionId: z.string(),
      status: z.enum(['active', 'pending', 'failed', 'inactive']),
      createdAt: z.string().optional(),
    }),
  ),
});

export const listConnectionFieldsResponseSchema = z.object({
  fields: z.array(
    z.object({
      name: z.string(),
      displayName: z.string().optional(),
      description: z.string().optional(),
      type: z.enum(['string', 'number', 'boolean']),
      required: z.boolean(),
      default: z.unknown().optional(),
    }),
  ),
});

export const toolIntegrationHealthResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});
