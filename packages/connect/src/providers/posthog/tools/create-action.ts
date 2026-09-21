// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const StepPropertySchema = z.object({
  key: z.string(),
  type: z.string(),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number(), z.boolean()]))]),
  operator: z.string(),
});

const StepSchema = z.object({
  event: z.string().optional(),
  properties: z.array(StepPropertySchema).optional(),
  selector: z.string().optional(),
  selector_regex: z.string().optional(),
  tag_name: z.string().optional(),
  text: z.string().optional(),
  text_matching: z.string().optional(),
  href: z.string().optional(),
  href_matching: z.string().optional(),
  url: z.string().optional(),
  url_matching: z.string().optional(),
});

export const createActionInputSchema = z.object({
  project_id: z.number().describe('PostHog project ID. Example: 309484'),
  name: z.string().describe('Name of the action. Example: "Clicked Sign Up Button"'),
  description: z.string().optional(),
  tags: z.array(z.string().nullable()).optional(),
  post_to_slack: z.boolean().optional(),
  slack_message_format: z.string().optional(),
  steps: z.array(StepSchema).optional(),
});

const CreatedBySchema = z.object({
  id: z.number(),
  uuid: z.string().nullable().optional(),
  distinct_id: z.string().nullable().optional(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  is_email_verified: z.boolean().nullable().optional(),
  hedgehog_config: z.record(z.string(), z.unknown()).nullable().optional(),
  role_at_organization: z.string().nullable().optional(),
});

const ProviderActionSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable().optional(),
  tags: z.array(z.string().nullable()).nullable().optional(),
  post_to_slack: z.boolean().nullable().optional(),
  slack_message_format: z.string().nullable().optional(),
  steps: z.array(StepSchema).nullable().optional(),
  created_at: z.string().nullable().optional(),
  created_by: CreatedBySchema.nullable().optional(),
  deleted: z.boolean().nullable().optional(),
  is_calculating: z.boolean().nullable().optional(),
  last_calculated_at: z.string().nullable().optional(),
  team_id: z.number().nullable().optional(),
  is_action: z.boolean().nullable().optional(),
  bytecode_error: z.string().nullable().optional(),
  pinned_at: z.string().nullable().optional(),
  creation_context: z.string().nullable().optional(),
  _create_in_folder: z.string().nullable().optional(),
  user_access_level: z.string().nullable().optional(),
});

export const createActionOutputSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string().nullable()).optional(),
  post_to_slack: z.boolean().optional(),
  slack_message_format: z.string().optional(),
  steps: z.array(StepSchema).optional(),
  created_at: z.string().optional(),
  deleted: z.boolean().optional(),
  is_calculating: z.boolean().optional(),
  last_calculated_at: z.string().optional(),
  team_id: z.number().optional(),
  is_action: z.boolean().optional(),
  bytecode_error: z.string().optional(),
  pinned_at: z.string().optional(),
  creation_context: z.string().optional(),
  user_access_level: z.string().optional(),
});

export function createActionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_create_action',
    description: 'Create an action (saved event pattern) in PostHog.',
    inputSchema: createActionInputSchema,
    outputSchema: createActionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createActionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://posthog.com/docs/api/actions
      const response = await platformProxy.post({
        endpoint: `/api/projects/${encodeURIComponent(String(input.project_id))}/actions/`,
        data: {
          name: input.name,
          ...(input.description !== undefined && { description: input.description }),
          ...(input.tags !== undefined && { tags: input.tags }),
          ...(input.post_to_slack !== undefined && { post_to_slack: input.post_to_slack }),
          ...(input.slack_message_format !== undefined && { slack_message_format: input.slack_message_format }),
          ...(input.steps !== undefined && { steps: input.steps }),
        },
        retries: 3,
      });

      const providerAction = ProviderActionSchema.parse(response.data);

      return {
        id: providerAction.id,
        name: providerAction.name,
        ...(providerAction.description != null && { description: providerAction.description }),
        ...(providerAction.tags != null && { tags: providerAction.tags }),
        ...(providerAction.post_to_slack != null && { post_to_slack: providerAction.post_to_slack }),
        ...(providerAction.slack_message_format != null && {
          slack_message_format: providerAction.slack_message_format,
        }),
        ...(providerAction.steps != null && { steps: providerAction.steps }),
        ...(providerAction.created_at != null && { created_at: providerAction.created_at }),
        ...(providerAction.deleted != null && { deleted: providerAction.deleted }),
        ...(providerAction.is_calculating != null && { is_calculating: providerAction.is_calculating }),
        ...(providerAction.last_calculated_at != null && { last_calculated_at: providerAction.last_calculated_at }),
        ...(providerAction.team_id != null && { team_id: providerAction.team_id }),
        ...(providerAction.is_action != null && { is_action: providerAction.is_action }),
        ...(providerAction.bytecode_error != null && { bytecode_error: providerAction.bytecode_error }),
        ...(providerAction.pinned_at != null && { pinned_at: providerAction.pinned_at }),
        ...(providerAction.creation_context != null && { creation_context: providerAction.creation_context }),
        ...(providerAction.user_access_level != null && { user_access_level: providerAction.user_access_level }),
      };
    },
  });
}
