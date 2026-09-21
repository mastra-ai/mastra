// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listEventDefinitionsInputSchema = z.object({
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  exclude_hidden: z.boolean().optional().describe('Exclude hidden event definitions'),
  exclude_stale: z.boolean().optional().describe('Exclude stale event definitions'),
  limit: z.number().int().optional().describe('Maximum number of results per page'),
  offset: z.number().int().optional().describe('Offset for pagination'),
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor (offset) from the previous response. Overrides offset if provided.'),
});

const UserSchema = z.object({
  id: z.number().nullish(),
  uuid: z.string().nullish(),
  distinct_id: z.string().nullish(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  email: z.string().nullish(),
  is_email_verified: z.boolean().nullish(),
  hedgehog_config: z.record(z.string(), z.unknown()).nullish(),
  role_at_organization: z.string().nullish(),
});

const ProviderEventDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  owner: z.number().nullish(),
  description: z.string().nullish(),
  tags: z.array(z.string().nullable()).nullish(),
  created_at: z.string().nullish(),
  updated_at: z.string().nullish(),
  updated_by: UserSchema.nullish(),
  last_seen_at: z.string().nullish(),
  last_updated_at: z.string().nullish(),
  verified: z.boolean().nullish(),
  verified_at: z.string().nullish(),
  verified_by: UserSchema.nullish(),
  hidden: z.boolean().nullish(),
  enforcement_mode: z.string().nullish(),
  primary_property: z.string().nullish(),
  is_action: z.boolean().nullish(),
  action_id: z.number().nullish(),
  is_calculating: z.boolean().nullish(),
  last_calculated_at: z.string().nullish(),
  created_by: UserSchema.nullish(),
  post_to_slack: z.boolean().nullish(),
  default_columns: z.array(z.string()).nullish(),
  media_preview_urls: z.array(z.string()).nullish(),
});

const ProviderResponseSchema = z.object({
  count: z.number(),
  next: z.string().nullable(),
  previous: z.string().nullable(),
  results: z.array(ProviderEventDefinitionSchema),
});

const EventDefinitionOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  owner: z.number().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  updated_by: UserSchema.optional(),
  last_seen_at: z.string().optional(),
  last_updated_at: z.string().optional(),
  verified: z.boolean().optional(),
  verified_at: z.string().optional(),
  verified_by: UserSchema.optional(),
  hidden: z.boolean().optional(),
  enforcement_mode: z.string().optional(),
  primary_property: z.string().optional(),
  is_action: z.boolean().optional(),
  action_id: z.number().optional(),
  is_calculating: z.boolean().optional(),
  last_calculated_at: z.string().optional(),
  created_by: UserSchema.optional(),
  post_to_slack: z.boolean().optional(),
  default_columns: z.array(z.string()).optional(),
  media_preview_urls: z.array(z.string()).optional(),
});

export const listEventDefinitionsOutputSchema = z.object({
  count: z.number(),
  next_cursor: z.string().optional(),
  previous_cursor: z.string().optional(),
  results: z.array(EventDefinitionOutputSchema),
});

function mapUser(user: z.infer<typeof UserSchema> | null | undefined): z.infer<typeof UserSchema> | undefined {
  if (!user) {
    return undefined;
  }
  const result: z.infer<typeof UserSchema> = {};
  if (user.id != null) {
    result.id = user.id;
  }
  if (user.uuid != null) {
    result.uuid = user.uuid;
  }
  if (user.distinct_id != null) {
    result.distinct_id = user.distinct_id;
  }
  if (user.first_name != null) {
    result.first_name = user.first_name;
  }
  if (user.last_name != null) {
    result.last_name = user.last_name;
  }
  if (user.email != null) {
    result.email = user.email;
  }
  if (user.is_email_verified != null) {
    result.is_email_verified = user.is_email_verified;
  }
  if (user.hedgehog_config != null) {
    result.hedgehog_config = user.hedgehog_config;
  }
  if (user.role_at_organization != null) {
    result.role_at_organization = user.role_at_organization;
  }
  return result;
}

function mapEventDefinition(
  def: z.infer<typeof ProviderEventDefinitionSchema>,
): z.infer<typeof EventDefinitionOutputSchema> {
  const result: z.infer<typeof EventDefinitionOutputSchema> = {
    id: def.id,
    name: def.name,
  };
  if (def.owner != null) {
    result.owner = def.owner;
  }
  if (def.description != null) {
    result.description = def.description;
  }
  if (def.tags != null) {
    result.tags = def.tags.filter((tag): tag is string => tag != null);
  }
  if (def.created_at != null) {
    result.created_at = def.created_at;
  }
  if (def.updated_at != null) {
    result.updated_at = def.updated_at;
  }
  const mappedUpdatedBy = mapUser(def.updated_by);
  if (mappedUpdatedBy !== undefined) {
    result.updated_by = mappedUpdatedBy;
  }
  if (def.last_seen_at != null) {
    result.last_seen_at = def.last_seen_at;
  }
  if (def.last_updated_at != null) {
    result.last_updated_at = def.last_updated_at;
  }
  if (def.verified != null) {
    result.verified = def.verified;
  }
  if (def.verified_at != null) {
    result.verified_at = def.verified_at;
  }
  const mappedVerifiedBy = mapUser(def.verified_by);
  if (mappedVerifiedBy !== undefined) {
    result.verified_by = mappedVerifiedBy;
  }
  if (def.hidden != null) {
    result.hidden = def.hidden;
  }
  if (def.enforcement_mode != null) {
    result.enforcement_mode = def.enforcement_mode;
  }
  if (def.primary_property != null) {
    result.primary_property = def.primary_property;
  }
  if (def.is_action != null) {
    result.is_action = def.is_action;
  }
  if (def.action_id != null) {
    result.action_id = def.action_id;
  }
  if (def.is_calculating != null) {
    result.is_calculating = def.is_calculating;
  }
  if (def.last_calculated_at != null) {
    result.last_calculated_at = def.last_calculated_at;
  }
  const mappedCreatedBy = mapUser(def.created_by);
  if (mappedCreatedBy !== undefined) {
    result.created_by = mappedCreatedBy;
  }
  if (def.post_to_slack != null) {
    result.post_to_slack = def.post_to_slack;
  }
  if (def.default_columns != null) {
    result.default_columns = def.default_columns;
  }
  if (def.media_preview_urls != null) {
    result.media_preview_urls = def.media_preview_urls;
  }
  return result;
}

function extractCursor(url: string | null): string | undefined {
  if (!url) {
    return undefined;
  }
  const parsed = new URL(url);
  const offset = parsed.searchParams.get('offset');
  return offset != null ? offset : undefined;
}

export function listEventDefinitionsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_list_event_definitions',
    description: 'List event definitions (auto-detected event schemas) from PostHog.',
    inputSchema: listEventDefinitionsInputSchema,
    outputSchema: listEventDefinitionsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listEventDefinitionsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string | number> = {};
      if (input.exclude_hidden !== undefined) {
        params['exclude_hidden'] = String(input.exclude_hidden);
      }
      if (input.exclude_stale !== undefined) {
        params['exclude_stale'] = String(input.exclude_stale);
      }
      if (input.limit !== undefined) {
        params['limit'] = input.limit;
      }
      if (input.cursor !== undefined) {
        params['offset'] = input.cursor;
      } else if (input.offset !== undefined) {
        params['offset'] = input.offset;
      }

      // https://posthog.com/docs/api/event-definitions
      const response = await platformProxy.get({
        endpoint: `/api/projects/${encodeURIComponent(input.project_id)}/event_definitions/`,
        params,
        retries: 3,
      });

      const providerResponse = ProviderResponseSchema.parse(response.data);

      const nextCursor = extractCursor(providerResponse.next);
      const previousCursor = extractCursor(providerResponse.previous);

      return {
        count: providerResponse.count,
        results: providerResponse.results.map(mapEventDefinition),
        ...(nextCursor !== undefined ? { next_cursor: nextCursor } : {}),
        ...(previousCursor !== undefined ? { previous_cursor: previousCursor } : {}),
      };
    },
  });
}
