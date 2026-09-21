// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getPropertyDefinitionInputSchema = z.object({
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  id: z.string().describe('Property definition ID (UUID). Example: "497f6eca-6276-4993-bfeb-53cbbbba6f08"'),
});

const UserSchema = z.object({
  id: z.number(),
  uuid: z.string(),
  distinct_id: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  email: z.string(),
  is_email_verified: z.boolean(),
  hedgehog_config: z.record(z.string(), z.unknown()),
  role_at_organization: z.string(),
});

const ProviderPropertyDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  is_numerical: z.boolean().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  updated_by: UserSchema.nullable().optional(),
  is_seen_on_filtered_events: z.boolean().nullable().optional(),
  property_type: z.string().nullable().optional(),
  verified: z.boolean().nullable().optional(),
  verified_at: z.string().nullable().optional(),
  verified_by: UserSchema.nullable().optional(),
  hidden: z.boolean().nullable().optional(),
});

export const getPropertyDefinitionOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  is_numerical: z.boolean().optional(),
  updated_at: z.string().optional(),
  updated_by: UserSchema.optional(),
  is_seen_on_filtered_events: z.boolean().optional(),
  property_type: z.string().optional(),
  verified: z.boolean().optional(),
  verified_at: z.string().optional(),
  verified_by: UserSchema.optional(),
  hidden: z.boolean().optional(),
});

export function getPropertyDefinitionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_get_property_definition',
    description: 'Retrieve a single property definition from PostHog.',
    inputSchema: getPropertyDefinitionInputSchema,
    outputSchema: getPropertyDefinitionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getPropertyDefinitionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://posthog.com/docs/api/property-definitions
      const response = await platformProxy.get({
        endpoint: `/api/projects/${encodeURIComponent(input.project_id)}/property_definitions/${encodeURIComponent(input.id)}/`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Property definition not found',
          project_id: input.project_id,
          id: input.id,
        });
      }

      const providerPropertyDefinition = ProviderPropertyDefinitionSchema.parse(response.data);

      return {
        id: providerPropertyDefinition.id,
        name: providerPropertyDefinition.name,
        ...(providerPropertyDefinition.description !== undefined &&
          providerPropertyDefinition.description !== null && {
            description: providerPropertyDefinition.description,
          }),
        ...(providerPropertyDefinition.tags !== undefined &&
          providerPropertyDefinition.tags !== null && {
            tags: providerPropertyDefinition.tags,
          }),
        ...(providerPropertyDefinition.is_numerical !== undefined &&
          providerPropertyDefinition.is_numerical !== null && {
            is_numerical: providerPropertyDefinition.is_numerical,
          }),
        ...(providerPropertyDefinition.updated_at !== undefined &&
          providerPropertyDefinition.updated_at !== null && {
            updated_at: providerPropertyDefinition.updated_at,
          }),
        ...(providerPropertyDefinition.updated_by !== undefined &&
          providerPropertyDefinition.updated_by !== null && {
            updated_by: providerPropertyDefinition.updated_by,
          }),
        ...(providerPropertyDefinition.is_seen_on_filtered_events !== undefined &&
          providerPropertyDefinition.is_seen_on_filtered_events !== null && {
            is_seen_on_filtered_events: providerPropertyDefinition.is_seen_on_filtered_events,
          }),
        ...(providerPropertyDefinition.property_type !== undefined &&
          providerPropertyDefinition.property_type !== null && {
            property_type: providerPropertyDefinition.property_type,
          }),
        ...(providerPropertyDefinition.verified !== undefined &&
          providerPropertyDefinition.verified !== null && {
            verified: providerPropertyDefinition.verified,
          }),
        ...(providerPropertyDefinition.verified_at !== undefined &&
          providerPropertyDefinition.verified_at !== null && {
            verified_at: providerPropertyDefinition.verified_at,
          }),
        ...(providerPropertyDefinition.verified_by !== undefined &&
          providerPropertyDefinition.verified_by !== null && {
            verified_by: providerPropertyDefinition.verified_by,
          }),
        ...(providerPropertyDefinition.hidden !== undefined &&
          providerPropertyDefinition.hidden !== null && {
            hidden: providerPropertyDefinition.hidden,
          }),
      };
    },
  });
}
