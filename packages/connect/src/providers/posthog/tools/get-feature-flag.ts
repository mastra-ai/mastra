// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getFeatureFlagInputSchema = z.object({
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  id: z.number().describe('Feature flag ID. Example: 700471'),
});

const UserSchema = z.object({
  id: z.number().nullish(),
  uuid: z.string().nullish(),
  distinct_id: z.string().nullish(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  email: z.string().nullish(),
  is_email_verified: z.boolean().nullish(),
  hedgehog_config: z.unknown().nullish(),
  role_at_organization: z.string().nullish(),
});

export const getFeatureFlagOutputSchema = z
  .object({
    id: z.number(),
    name: z.string().nullish(),
    key: z.string().nullish(),
    filters: z.unknown().nullish(),
    deleted: z.boolean().nullish(),
    active: z.boolean().nullish(),
    created_by: UserSchema.nullish(),
    created_at: z.string().nullish(),
    updated_at: z.string().nullish(),
    version: z.number().nullish(),
    last_modified_by: UserSchema.nullish(),
    ensure_experience_continuity: z.boolean().nullish(),
    experiment_set: z.array(z.number()).nullish(),
    experiment_set_metadata: z.array(z.unknown()).nullish(),
    surveys: z.unknown().nullish(),
    features: z.unknown().nullish(),
    rollback_conditions: z.unknown().nullish(),
    performed_rollback: z.boolean().nullish(),
    can_edit: z.boolean().nullish(),
    tags: z.array(z.string()).nullish(),
    evaluation_contexts: z.array(z.unknown()).nullish(),
    usage_dashboard: z.number().nullish(),
    analytics_dashboards: z.array(z.number()).nullish(),
    has_enriched_analytics: z.boolean().nullish(),
    user_access_level: z.string().nullish(),
    creation_context: z.string().nullish(),
    is_remote_configuration: z.boolean().nullish(),
    has_encrypted_payloads: z.boolean().nullish(),
    status: z.string().nullish(),
    evaluation_runtime: z.string().nullish(),
    bucketing_identifier: z.string().nullish(),
    last_called_at: z.string().nullish(),
    _create_in_folder: z.string().nullish(),
    _should_create_usage_dashboard: z.boolean().nullish(),
    is_used_in_replay_settings: z.boolean().nullish(),
  })
  .passthrough();

export function getFeatureFlagTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_get_feature_flag',
    description: 'Retrieve a single feature flag from PostHog.',
    inputSchema: getFeatureFlagInputSchema,
    outputSchema: getFeatureFlagOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getFeatureFlagOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://posthog.com/docs/api/feature-flags#retrieve-feature-flags
        endpoint: `/api/projects/${encodeURIComponent(input.project_id)}/feature_flags/${encodeURIComponent(String(input.id))}/`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Feature flag not found',
          id: input.id,
        });
      }

      const featureFlag = getFeatureFlagOutputSchema.parse(response.data);

      return featureFlag;
    },
  });
}
