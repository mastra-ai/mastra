import { z } from 'zod';

/**
 * Static model selection captured by the form. Mirrors `StorageModelConfig`'s
 * core fields (`{ provider, name }`) — the form does not own conditional models;
 * those are loaded as a read-only banner via `stored-agent-to-form-values`.
 */
export const AgentBuilderModelSchema = z.object({
  provider: z.string().min(1),
  name: z.string().min(1),
});

const LABEL_REGEX = /^[A-Za-z0-9 _-]+$/;
const LABEL_MAX_LEN = 32;

/**
 * Form-side `Connection` shape. Mirrors `StoredIntegrationConnection` from
 * `@mastra/client-js`. `kind` is locked to `'author'` for v1; the picker
 * never produces other kinds and the mapper hardcodes the literal on save.
 * `invoker` (v1.5) and `platform` (v2) will lift this into a form toggle.
 */
export const connectionFormSchema = z
  .object({
    kind: z.literal('author'),
    toolService: z.string().min(1),
    connectionId: z.string().min(1),
    label: z.string().min(1).max(LABEL_MAX_LEN).regex(LABEL_REGEX),
  })
  .passthrough();

/**
 * Form-side `ToolIntegrationConfig`. Note `tools[slug]` carries `toolService`
 * inline so we never have to string-split the slug or thread a side map
 * through `superRefine`. The mapper strips `toolService` on save (it lives
 * on each connection in storage, not on tool entries).
 */
const toolIntegrationConfigFormSchema = z
  .object({
    tools: z.record(
      z.string(),
      z
        .object({
          toolService: z.string().min(1),
          description: z.string().optional(),
        })
        .passthrough(),
    ),
    connections: z.record(z.string(), z.array(connectionFormSchema)),
  })
  .passthrough();

export const AgentBuilderEditFormSchema = z
  .object({
    name: z.string(),
    description: z.string().optional(),
    instructions: z.string(),
    tools: z.record(z.string(), z.boolean()).optional(),
    agents: z.record(z.string(), z.boolean()).optional(),
    workflows: z.record(z.string(), z.boolean()).optional(),
    skills: z.record(z.string(), z.boolean()).optional(),
    workspaceId: z.string().optional(),
    visibility: z.enum(['private', 'public']).default('private').optional(),
    browserEnabled: z.boolean().default(false).optional(),
    /**
     * Selected static model. Optional — the create path's decision matrix decides
     * whether this is required at submit time based on the admin's model policy.
     */
    model: AgentBuilderModelSchema.optional(),
    avatarUrl: z.string().optional(),
    /**
     * Selected tool-integration tools and their per-toolService connection
     * bindings. Keyed by `providerId` (e.g. `'composio'`). Optional and
     * absent when the agent has no integration tools selected.
     */
    toolIntegrations: z.record(z.string(), toolIntegrationConfigFormSchema).optional(),
  })
  .superRefine((value, ctx) => {
    const integrations = value.toolIntegrations;
    if (!integrations) return;

    for (const [providerId, config] of Object.entries(integrations)) {
      // Label uniqueness (case-insensitive) per toolService.
      for (const [toolService, connections] of Object.entries(config.connections ?? {})) {
        const seenLabels = new Map<string, number>();
        connections.forEach((connection, index) => {
          const key = connection.label.toLowerCase();
          const previous = seenLabels.get(key);
          if (previous !== undefined) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Duplicate label "${connection.label}" on ${toolService} (case-insensitive)`,
              path: ['toolIntegrations', providerId, 'connections', toolService, index, 'label'],
            });
          } else {
            seenLabels.set(key, index);
          }
        });
      }

      // Every selected tool must have at least one connection on its toolService.
      for (const [slug, meta] of Object.entries(config.tools ?? {})) {
        const bucket = config.connections?.[meta.toolService] ?? [];
        if (bucket.length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Tool "${slug}" requires at least one connection for ${meta.toolService}`,
            path: ['toolIntegrations', providerId, 'tools', slug],
          });
        }
      }
    }
  });

export type AgentBuilderModel = z.infer<typeof AgentBuilderModelSchema>;
export type AgentBuilderConnection = z.infer<typeof connectionFormSchema>;
export type AgentBuilderEditFormValues = z.infer<typeof AgentBuilderEditFormSchema>;
