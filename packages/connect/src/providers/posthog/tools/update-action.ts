// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
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
  properties: z.array(StepPropertySchema).nullable().optional(),
  selector: z.string().nullable().optional(),
  selector_regex: z.string().nullable().optional(),
  tag_name: z.string().nullable().optional(),
  text: z.string().nullable().optional(),
  text_matching: z.string().nullable().optional(),
  href: z.string().nullable().optional(),
  href_matching: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  url_matching: z.string().nullable().optional(),
});

const CreatedBySchema = z.object({
  id: z.number(),
  uuid: z.string(),
  distinct_id: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  email: z.string(),
  is_email_verified: z.boolean(),
  hedgehog_config: z.unknown().nullable().optional(),
  role_at_organization: z.string(),
});

export const updateActionInputSchema = z.object({
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  id: z.number().describe('Action ID. Example: 275761'),
  name: z.string().nullable().optional().describe('Action name. Set to null to clear.'),
  description: z.string().optional().describe('Action description.'),
  tags: z.array(z.string()).optional().describe('Tags to attach to the action.'),
  post_to_slack: z.boolean().optional().describe('Whether to post to Slack.'),
  slack_message_format: z.string().optional().describe('Slack message format string.'),
  steps: z.array(StepSchema).optional().describe('Action steps.'),
  deleted: z.boolean().optional().describe('Whether the action is deleted.'),
  pinned_at: z.string().nullable().optional().describe('ISO timestamp to pin the action. Set to null to unpin.'),
  last_calculated_at: z.string().optional().describe('ISO timestamp of last calculation.'),
  _create_in_folder: z.string().optional().describe('Folder ID to create the action in.'),
});

export const updateActionOutputSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  post_to_slack: z.boolean().optional(),
  slack_message_format: z.string().optional(),
  steps: z.array(StepSchema).optional(),
  created_at: z.string().optional(),
  created_by: CreatedBySchema.optional(),
  deleted: z.boolean().optional(),
  is_calculating: z.boolean().optional(),
  last_calculated_at: z.string().optional(),
  team_id: z.number().optional(),
  is_action: z.boolean().optional(),
  bytecode_error: z.string().nullable().optional(),
  pinned_at: z.string().nullable().optional(),
  creation_context: z.string().nullable().optional(),
  _create_in_folder: z.string().optional(),
  user_access_level: z.string().optional(),
});

export function updateActionTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_update_action',
    description: 'Update an action in PostHog.',
    inputSchema: updateActionInputSchema,
    outputSchema: updateActionOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateActionOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const projectId = input.project_id;

      const patchData: Record<string, unknown> = {};
      if (input.name !== undefined) {
        patchData['name'] = input.name;
      }
      if (input.description !== undefined) {
        patchData['description'] = input.description;
      }
      if (input.tags !== undefined) {
        patchData['tags'] = input.tags;
      }
      if (input.post_to_slack !== undefined) {
        patchData['post_to_slack'] = input.post_to_slack;
      }
      if (input.slack_message_format !== undefined) {
        patchData['slack_message_format'] = input.slack_message_format;
      }
      if (input.steps !== undefined) {
        patchData['steps'] = input.steps;
      }
      if (input.deleted !== undefined) {
        patchData['deleted'] = input.deleted;
      }
      if (input.pinned_at !== undefined) {
        patchData['pinned_at'] = input.pinned_at;
      }
      if (input.last_calculated_at !== undefined) {
        patchData['last_calculated_at'] = input.last_calculated_at;
      }
      if (input._create_in_folder !== undefined) {
        patchData['_create_in_folder'] = input._create_in_folder;
      }

      // https://posthog.com/docs/api/actions
      const response = await platformProxy.patch({
        endpoint: `/api/projects/${encodeURIComponent(projectId)}/actions/${encodeURIComponent(input.id)}/`,
        data: patchData,
        retries: 3,
      });

      const providerAction = updateActionOutputSchema.parse(response.data);

      return providerAction;
    },
  });
}
