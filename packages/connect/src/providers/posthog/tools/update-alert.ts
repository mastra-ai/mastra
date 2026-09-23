// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateAlertInputSchema = z.object({
  id: z.string().describe('Alert ID. Example: "019e8d60-cb63-0000-f88c-60b06ee41715"'),
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  insight: z.number().optional(),
  name: z.string().optional(),
  subscribed_users: z.array(z.number()).optional(),
  threshold: z.record(z.string(), z.unknown()).optional(),
  condition: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  detector_config: z.record(z.string(), z.unknown()).optional(),
  calculation_interval: z.string().optional(),
  snoozed_until: z.string().nullable().optional(),
  skip_weekend: z.boolean().nullable().optional(),
  schedule_restriction: z.record(z.string(), z.unknown()).optional(),
  investigation_agent_enabled: z.boolean().optional(),
  investigation_gates_notifications: z.boolean().optional(),
  investigation_inconclusive_action: z.string().optional(),
});

const CreatedBySchema = z.object({
  id: z.number(),
  uuid: z.string(),
  distinct_id: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  email: z.string(),
  is_email_verified: z.boolean(),
  hedgehog_config: z.unknown().nullable(),
  role_at_organization: z.string(),
});

const InsightSchema = z.object({
  id: z.number(),
  short_id: z.string(),
  name: z.string().nullable(),
  derived_name: z.string().nullable(),
  filters: z.record(z.string(), z.unknown()),
  query: z.unknown().nullable(),
  dashboards: z.array(z.unknown()),
  dashboard_tiles: z.array(z.unknown()),
  description: z.string().nullable(),
  last_refresh: z.string().nullable(),
  refreshing: z.boolean(),
  saved: z.boolean(),
  updated_at: z.string(),
  created_by: CreatedBySchema,
  created_at: z.string(),
  last_modified_at: z.string(),
  favorited: z.boolean(),
  user_access_level: z.string().nullable(),
  last_viewed_at: z.string().nullable(),
  tags: z.array(z.unknown()),
});

const ThresholdConfigurationSchema = z.object({
  type: z.string(),
  bounds: z.record(z.string(), z.unknown()).nullable().optional(),
});

const ThresholdSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  name: z.string(),
  configuration: ThresholdConfigurationSchema,
});

const ConditionSchema = z.object({
  type: z.string(),
});

const AlertConfigSchema = z.object({
  type: z.string(),
  series_index: z.number(),
  check_ongoing_interval: z.boolean().nullable().optional(),
});

export const updateAlertOutputSchema = z.object({
  id: z.string(),
  created_by: CreatedBySchema,
  created_at: z.string(),
  insight: InsightSchema,
  name: z.string(),
  subscribed_users: z.array(z.number()),
  threshold: ThresholdSchema,
  condition: ConditionSchema,
  state: z.string(),
  enabled: z.boolean(),
  last_notified_at: z.string().nullable(),
  last_checked_at: z.string().nullable(),
  next_check_at: z.string().nullable(),
  config: AlertConfigSchema,
  detector_config: z.record(z.string(), z.unknown()).nullable(),
  calculation_interval: z.string(),
  snoozed_until: z.string().nullable(),
  skip_weekend: z.boolean().nullable(),
  schedule_restriction: z.record(z.string(), z.unknown()).nullable(),
  last_value: z.number().nullable(),
  investigation_agent_enabled: z.boolean(),
  investigation_gates_notifications: z.boolean(),
  investigation_inconclusive_action: z.string(),
});

export function updateAlertTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_update_alert',
    description: 'Update an alert in PostHog.',
    inputSchema: updateAlertInputSchema,
    outputSchema: updateAlertOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateAlertOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const data: Record<string, unknown> = {};

      if (input.insight !== undefined) {
        data['insight'] = input.insight;
      }
      if (input.name !== undefined) {
        data['name'] = input.name;
      }
      if (input.subscribed_users !== undefined) {
        data['subscribed_users'] = input.subscribed_users;
      }
      if (input.threshold !== undefined) {
        data['threshold'] = input.threshold;
      }
      if (input.condition !== undefined) {
        data['condition'] = input.condition;
      }
      if (input.enabled !== undefined) {
        data['enabled'] = input.enabled;
      }
      if (input.config !== undefined) {
        data['config'] = input.config;
      }
      if (input.detector_config !== undefined) {
        data['detector_config'] = input.detector_config;
      }
      if (input.calculation_interval !== undefined) {
        data['calculation_interval'] = input.calculation_interval;
      }
      if (input.snoozed_until !== undefined) {
        data['snoozed_until'] = input.snoozed_until;
      }
      if (input.skip_weekend !== undefined) {
        data['skip_weekend'] = input.skip_weekend;
      }
      if (input.schedule_restriction !== undefined) {
        data['schedule_restriction'] = input.schedule_restriction;
      }
      if (input.investigation_agent_enabled !== undefined) {
        data['investigation_agent_enabled'] = input.investigation_agent_enabled;
      }
      if (input.investigation_gates_notifications !== undefined) {
        data['investigation_gates_notifications'] = input.investigation_gates_notifications;
      }
      if (input.investigation_inconclusive_action !== undefined) {
        data['investigation_inconclusive_action'] = input.investigation_inconclusive_action;
      }

      // https://posthog.com/docs/api/alerts
      const response = await platformProxy.patch({
        endpoint: `/api/projects/${encodeURIComponent(input.project_id)}/alerts/${encodeURIComponent(input.id)}/`,
        data,
        retries: 3,
      });

      const alert = updateAlertOutputSchema.parse(response.data);
      return alert;
    },
  });
}
