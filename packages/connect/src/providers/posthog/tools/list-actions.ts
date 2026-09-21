// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const listActionsInputSchema = z.object({
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor (offset value) from the previous response. Omit for the first page.'),
  limit: z.number().optional().describe('Number of results to return per page.'),
});

const ActionStepPropertySchema = z.object({
  key: z.string().nullish(),
  type: z.string().nullish(),
  value: z
    .union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number(), z.boolean()]))])
    .nullish(),
  operator: z.string().nullish(),
});

const ActionStepSchema = z.object({
  event: z.string().nullish(),
  properties: z.array(ActionStepPropertySchema).nullish(),
  selector: z.string().nullish(),
  selector_regex: z.string().nullish(),
  tag_name: z.string().nullish(),
  text: z.string().nullish(),
  text_matching: z.string().nullish(),
  href: z.string().nullish(),
  href_matching: z.string().nullish(),
  url: z.string().nullish(),
  url_matching: z.string().nullish(),
});

const CreatedBySchema = z.object({
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

const ProviderActionSchema = z.object({
  id: z.number(),
  name: z.string().nullish(),
  description: z.string().nullish(),
  tags: z.array(z.string().nullable()).nullish(),
  post_to_slack: z.boolean().nullish(),
  slack_message_format: z.string().nullish(),
  steps: z.array(ActionStepSchema).nullish(),
  created_at: z.string().nullish(),
  created_by: CreatedBySchema.nullish(),
  deleted: z.boolean().nullish(),
  is_calculating: z.boolean().nullish(),
  last_calculated_at: z.string().nullish(),
  team_id: z.number().nullish(),
  is_action: z.boolean().nullish(),
  bytecode_error: z.string().nullish(),
  pinned_at: z.string().nullish(),
  creation_context: z.string().nullish(),
  _create_in_folder: z.string().nullish(),
  user_access_level: z.string().nullish(),
});

export const listActionsOutputSchema = z.object({
  items: z.array(ProviderActionSchema),
  next_cursor: z.string().optional(),
});

export function listActionsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_list_actions',
    description: 'List actions (saved event patterns) from PostHog.',
    inputSchema: listActionsInputSchema,
    outputSchema: listActionsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listActionsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const projectId = input.project_id;

      const params: { offset?: string | number; limit?: string | number } = {};
      if (input.cursor !== undefined) {
        params.offset = input.cursor;
      }
      if (input.limit !== undefined) {
        params.limit = input.limit;
      }

      const config: PlatformProxyRequest = {
        // https://posthog.com/docs/api/actions
        endpoint: `/api/projects/${encodeURIComponent(String(projectId))}/actions/`,
        params,
        retries: 3,
      };

      const response = await platformProxy.get(config);

      const providerResponse = z
        .object({
          count: z.number().optional(),
          next: z.string().nullable().optional(),
          previous: z.string().nullable().optional(),
          results: z.array(z.unknown()),
        })
        .parse(response.data);

      const items = providerResponse.results.map(item => ProviderActionSchema.parse(item));

      let nextCursor: string | undefined;
      if (providerResponse.next) {
        const nextUrl = new URL(providerResponse.next);
        const offset = nextUrl.searchParams.get('offset');
        if (offset) {
          nextCursor = offset;
        }
      }

      return {
        items,
        ...(nextCursor !== undefined && { next_cursor: nextCursor }),
      };
    },
  });
}
