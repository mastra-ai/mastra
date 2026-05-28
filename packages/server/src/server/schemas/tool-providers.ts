import { z } from 'zod/v4';

// ============================================================================
// Stored form shape — `toolProviders` field on agents
// ============================================================================

/**
 * Zod schemas for the Agent Builder / CMS tool providers storage shape.
 *
 * Rules:
 *  - **Additive-only.** No version field. Future fields are introduced as
 *    optional and existing fields are never removed in v1.x.
 *  - `label` lives on the connection row itself (set via
 *    `PATCH /tool-providers/:providerId/connections/:connectionId`), not on
 *    the pin. The optional `label` field below is retained only for
 *    back-compat with older stored configs; the server does not enforce
 *    anything on it.
 *  - `kind` accepts all three values for forward-compat; v1 only writes
 *    `'author'`.
 */

const labelSchema = z
  .string()
  .min(1, 'Connection label is required')
  .max(32, 'Connection label must be ≤ 32 characters')
  .regex(/^[A-Za-z0-9 _-]+$/, 'Connection label may only contain letters, digits, spaces, _ and -');

/**
 * Per-pin identity bucketing.
 *
 * - `'per-author'` (default) — bucketed under the caller's resolved authorId.
 * - `'shared'` — bucketed under SHARED_BUCKET_ID; visible to every caller.
 * - `'caller-supplied'` — bucketed under `requestContext[MASTRA_RESOURCE_ID_KEY]`.
 *
 * Optional for back-compat with pre-scope stored pins.
 */
export const connectionScopeSchema = z.enum(['shared', 'per-author', 'caller-supplied']);

export const connectionSchema = z.object({
  kind: z.enum(['author', 'invoker', 'platform']),
  toolkit: z.string().min(1),
  connectionId: z.string(),
  label: labelSchema.optional(),
  scope: connectionScopeSchema.optional(),
});

const toolMetaSchema = z.object({
  toolkit: z.string().min(1).optional(),
  description: z.string().optional(),
});

/**
 * Stored shape for one provider's configuration on one agent.
 *
 * Labels are no longer enforced on the pin: they live on the connection row
 * and are set via `PATCH /tool-providers/:providerId/connections/:connectionId`.
 */
export const toolProviderConfigSchema = z.object({
  tools: z.record(z.string(), toolMetaSchema),
  connections: z.record(z.string(), z.array(connectionSchema)),
});

/**
 * Full v1 tool providers payload: keyed by provider id.
 */
export const toolProvidersSchema = z.record(z.string(), toolProviderConfigSchema);

// ============================================================================
// HTTP route schemas — /tool-providers/*
// ============================================================================

// Path Parameter Schemas

export const toolProviderIdPathParams = z.object({
  providerId: z.string().describe('Unique identifier for the tool provider'),
});

export const toolSlugPathParams = toolProviderIdPathParams.extend({
  toolSlug: z.string().describe('Slug identifier for the tool'),
});

export const toolProviderAuthStatusPathParams = toolProviderIdPathParams.extend({
  authId: z.string().describe('Opaque auth handle returned by authorize'),
});

export const toolProviderConnectionPathParams = toolProviderIdPathParams.extend({
  connectionId: z.string().describe('Adapter-native connection id (e.g. Composio ca_...)'),
});

// Query Parameter Schemas

export const listToolProviderToolsQuerySchema = z.object({
  toolkit: z.string().optional().describe('Filter tools by toolkit slug'),
  search: z.string().optional().describe('Search tools by name or description'),
  page: z.coerce.number().optional().describe('Page number for pagination (1-indexed)'),
  perPage: z.coerce.number().optional().describe('Number of items per page'),
});

export const listConnectionFieldsQuerySchema = z.object({
  toolkit: z.string().describe('Toolkit slug whose connection field schema to list'),
});

export const listConnectionsQuerySchema = z.object({
  toolkit: z.string().describe('Toolkit slug whose connections to list'),
  authorId: z
    .string()
    .optional()
    .describe('Admin-only: restrict listing to a specific author. Silently ignored for non-admin callers.'),
  scope: connectionScopeSchema
    .optional()
    .describe('Filter results by scope. Omit to include shared + per-author pins for the caller.'),
  cursor: z.string().optional().describe('Opaque pagination cursor returned by a previous call'),
  limit: z.coerce.number().int().positive().max(200).optional().describe('Max items per page (default 50, max 200)'),
});

export const disconnectConnectionQuerySchema = z.object({
  force: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .describe('When true, revoke at the provider and drop the row even if pinned by agents'),
  toolkit: z.string().optional().describe('Toolkit slug for the connection (used when the row was upserted with one)'),
});

export const connectionUsageQuerySchema = z.object({
  toolkit: z.string().optional().describe('Optional toolkit slug to scope the usage scan'),
});

// Body Schemas

export const authorizeToolProviderBodySchema = z.object({
  toolkit: z.string().describe('Toolkit slug being authorized'),
  connectionId: z.string().describe('Existing or newly-minted connection bucket id'),
  toolName: z.string().optional().describe('Optional tool slug for tool-scoped authorization'),
  config: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Provider-specific user-supplied connection fields (e.g. subdomain)'),
  label: z
    .string()
    .max(64)
    .nullish()
    .describe('Optional human label to persist on the resulting tool_provider_connections row'),
  scope: connectionScopeSchema
    .optional()
    .describe(
      'Identity bucket. "shared" pins under SHARED_BUCKET_ID. "caller-supplied" pins under the request-context resourceId (returns 400 when missing). Defaults to "per-author".',
    ),
});

export const connectionStatusToolProviderBodySchema = z.object({
  items: z
    .array(
      z.object({
        connectionId: z.string(),
        toolkit: z.string(),
      }),
    )
    .describe('Connection tuples to batch-check'),
});

// ============================================================================
// Response Schemas
// ============================================================================

const paginationSchema = z
  .object({
    total: z.number().optional(),
    page: z.number().optional(),
    perPage: z.number().optional(),
    hasMore: z.boolean(),
  })
  .optional();

const capabilitiesSchema = z.object({
  multipleConnectionsPerToolkit: z.boolean(),
  batchConnectionStatus: z.boolean(),
  reauthorizeReusesConnectionId: z.boolean(),
  supportsRevoke: z.boolean().optional(),
});

export const listToolProvidersResponseSchema = z.object({
  providers: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().optional(),
      displayName: z.string().optional(),
      capabilities: capabilitiesSchema.optional(),
    }),
  ),
});

export const listToolProviderToolkitsResponseSchema = z.object({
  data: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      description: z.string().optional(),
      icon: z.string().optional(),
    }),
  ),
  pagination: paginationSchema,
});

export const listToolProviderToolsResponseSchema = z.object({
  data: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      description: z.string().optional(),
      toolkit: z.string().optional(),
    }),
  ),
  pagination: paginationSchema,
});

export const getToolProviderToolSchemaResponseSchema = z.record(z.string(), z.unknown());

export const authorizeToolProviderResponseSchema = z.object({
  url: z.string(),
  authId: z.string(),
});

export const authStatusToolProviderResponseSchema = z.object({
  status: z.enum(['pending', 'completed', 'failed']),
});

export const connectionStatusToolProviderResponseSchema = z.object({
  items: z.record(z.string(), z.object({ connected: z.boolean() })),
});

export const listConnectionsResponseSchema = z.object({
  items: z.array(
    z.object({
      connectionId: z.string(),
      status: z.enum(['active', 'pending', 'failed', 'inactive']),
      createdAt: z.string().optional(),
      label: z.string().nullish().describe('Persisted display label from tool_provider_connections, if any'),
      authorId: z.string().optional().describe('Owner of the connection (when known)'),
      scope: connectionScopeSchema
        .optional()
        .describe('Persisted scope from tool_provider_connections. Missing for rows that predate the scope field.'),
    }),
  ),
  nextCursor: z.string().optional().describe('Opaque cursor for the next page, when more results exist'),
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

export const disconnectConnectionResponseSchema = z.object({
  ok: z.literal(true),
  revoked: z.boolean().describe('Whether the provider-side connection was revoked'),
});

export const updateConnectionBodySchema = z.object({
  label: z
    .union([labelSchema, z.literal(''), z.null()])
    .describe('New display label for the connection. Pass null (or empty string) to clear the existing label.'),
});

export const updateConnectionResponseSchema = z.object({
  ok: z.literal(true),
  label: z.string().nullable().describe('The persisted label after the update (null when cleared)'),
});

export const connectionUsageResponseSchema = z.object({
  agents: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
    }),
  ),
});

export const toolProviderHealthResponseSchema = z.object({
  ok: z.boolean(),
  message: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});
