import { z } from 'zod';

import { toolProvidersFormSchema, validateToolProviders } from '@/domains/tool-providers/schemas';

/**
 * Static model selection captured by the form. Mirrors `StorageModelConfig`'s
 * core fields (`{ provider, name }`) — the form does not own conditional models;
 * those are loaded as a read-only banner via `stored-agent-to-form-values`.
 */
export const AgentBuilderModelSchema = z.object({
  provider: z.string().min(1),
  name: z.string().min(1),
});

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
     * Tool-provider pins (Composio etc). Shape is shared with the integrations
     * page; see `@/domains/tool-providers/schemas`.
     */
    toolProviders: toolProvidersFormSchema.optional(),
  })
  .superRefine((value, ctx) => {
    validateToolProviders(value.toolProviders, ctx, ['toolProviders']);
  });

export type AgentBuilderModel = z.infer<typeof AgentBuilderModelSchema>;
export type AgentBuilderEditFormValues = z.infer<typeof AgentBuilderEditFormSchema>;
