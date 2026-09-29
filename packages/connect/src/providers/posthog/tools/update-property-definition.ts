// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updatePropertyDefinitionInputSchema = z.object({
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  id: z.string().describe('Property definition ID. Example: "497f6eca-6276-4993-bfeb-53cbbbba6f08"'),
  description: z.string().nullable().optional().describe('Description of the property definition.'),
  tags: z.array(z.string()).optional().describe('Tags associated with the property definition.'),
  property_type: z.string().optional().describe('Type of the property. Example: "DateTime", "String", "Numeric"'),
  verified: z.boolean().optional().describe('Whether the property definition is verified.'),
  hidden: z.boolean().nullable().optional().describe('Whether the property definition is hidden.'),
});

const UpdatedBySchema = z.object({
  id: z.number(),
  uuid: z.string(),
  distinct_id: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  email: z.string(),
  is_email_verified: z.boolean(),
  hedgehog_config: z.record(z.string(), z.unknown()).nullable(),
  role_at_organization: z.string(),
});

const ProviderPropertyDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  tags: z.array(z.string().nullable()).optional(),
  is_numerical: z.boolean().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  updated_by: UpdatedBySchema.nullable().optional(),
  is_seen_on_filtered_events: z.boolean().nullable().optional(),
  property_type: z.string().nullable().optional(),
  verified: z.boolean().nullable().optional(),
  verified_at: z.string().nullable().optional(),
  verified_by: UpdatedBySchema.nullable().optional(),
  hidden: z.boolean().nullable().optional(),
});

export const updatePropertyDefinitionOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  is_numerical: z.boolean().optional(),
  updated_at: z.string().optional(),
  updated_by: UpdatedBySchema.optional(),
  is_seen_on_filtered_events: z.boolean().optional(),
  property_type: z.string().optional(),
  verified: z.boolean().optional(),
  verified_at: z.string().optional(),
  verified_by: UpdatedBySchema.nullable().optional(),
  hidden: z.boolean().optional(),
});

export function updatePropertyDefinitionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_update_property_definition',
    description: 'Update a property definition in PostHog.',
    inputSchema: updatePropertyDefinitionInputSchema,
    outputSchema: updatePropertyDefinitionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updatePropertyDefinitionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const projectId = input.project_id;

      // https://posthog.com/docs/api/property-definitions
      const response = await platformProxy.patch({
        endpoint: `/api/projects/${encodeURIComponent(projectId)}/property_definitions/${encodeURIComponent(input.id)}/`,
        data: {
          ...(input.description !== undefined && { description: input.description }),
          ...(input.tags !== undefined && { tags: input.tags }),
          ...(input.property_type !== undefined && { property_type: input.property_type }),
          ...(input.verified !== undefined && { verified: input.verified }),
          ...(input.hidden !== undefined && { hidden: input.hidden }),
        },
        retries: 3,
      });

      const providerData = ProviderPropertyDefinitionSchema.parse(response.data);

      return {
        id: providerData.id,
        name: providerData.name,
        ...(providerData.description != null && { description: providerData.description }),
        ...(providerData.tags != null && {
          tags: providerData.tags.filter(t => t != null),
        }),
        ...(providerData.is_numerical != null && { is_numerical: providerData.is_numerical }),
        ...(providerData.updated_at != null && { updated_at: providerData.updated_at }),
        ...(providerData.updated_by != null && { updated_by: providerData.updated_by }),
        ...(providerData.is_seen_on_filtered_events != null && {
          is_seen_on_filtered_events: providerData.is_seen_on_filtered_events,
        }),
        ...(providerData.property_type != null && { property_type: providerData.property_type }),
        ...(providerData.verified != null && { verified: providerData.verified }),
        ...(providerData.verified_at != null && { verified_at: providerData.verified_at }),
        ...(providerData.verified_by !== undefined && { verified_by: providerData.verified_by }),
        ...(providerData.hidden != null && { hidden: providerData.hidden }),
      };
    },
  });
}
