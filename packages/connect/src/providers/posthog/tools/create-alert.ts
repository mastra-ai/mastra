// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createAlertInputSchema = z.object({
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  insight: z.number().describe('Insight ID to monitor. Example: 9038220'),
  name: z.string().describe('Name of the alert.'),
  condition_type: z.enum(['absolute_value', 'relative_increase', 'relative_decrease']).describe('Condition type.'),
  threshold_type: z.enum(['absolute', 'percentage']).describe('Threshold type.'),
  threshold_lower: z.number().optional().nullable().describe('Lower bound of the threshold.'),
  threshold_upper: z.number().optional().nullable().describe('Upper bound of the threshold.'),
  calculation_interval: z.enum(['every_15_minutes', 'hourly', 'daily', 'weekly', 'monthly']).optional(),
  subscribed_users: z.array(z.number()).optional(),
  config_series_index: z.number().optional(),
  config_check_ongoing_interval: z.boolean().optional(),
  enabled: z.boolean().optional(),
  skip_weekend: z.boolean().optional(),
  snoozed_until: z.string().optional().nullable(),
  detector_config: z.record(z.string(), z.unknown()).optional().nullable(),
  schedule_restriction: z.record(z.string(), z.unknown()).optional().nullable(),
  investigation_agent_enabled: z.boolean().optional(),
  investigation_gates_notifications: z.boolean().optional(),
  investigation_inconclusive_action: z.string().optional(),
});

const InsightSchema = z
  .object({
    id: z.number(),
    short_id: z.string().optional(),
    name: z.string().optional(),
  })
  .passthrough();

const ProviderAlertSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  insight: z.union([z.number(), InsightSchema]),
  name: z.string(),
  subscribed_users: z.array(z.number()),
  threshold: z
    .object({
      configuration: z
        .object({
          type: z.string().optional(),
          bounds: z
            .object({
              lower: z.number().optional(),
              upper: z.number().optional(),
            })
            .optional(),
        })
        .optional(),
    })
    .optional(),
  condition: z
    .object({
      type: z.string().optional(),
    })
    .optional(),
  state: z.string(),
  enabled: z.boolean(),
  config: z
    .object({
      type: z.string().optional(),
      series_index: z.number().optional(),
      check_ongoing_interval: z.boolean().optional(),
    })
    .optional(),
  detector_config: z.record(z.string(), z.unknown()).nullable().optional(),
  calculation_interval: z.string(),
  snoozed_until: z.string().nullable().optional(),
  skip_weekend: z.boolean().optional(),
  schedule_restriction: z.record(z.string(), z.unknown()).nullable().optional(),
  last_value: z.number().nullable().optional(),
  investigation_agent_enabled: z.boolean().optional(),
  investigation_gates_notifications: z.boolean().optional(),
  investigation_inconclusive_action: z.string().optional(),
});

export const createAlertOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  insight_id: z.number(),
  state: z.string(),
  enabled: z.boolean(),
  calculation_interval: z.string(),
  condition_type: z.string().optional(),
  threshold_type: z.string().optional(),
  threshold_lower: z.number().optional(),
  threshold_upper: z.number().optional(),
  config_series_index: z.number().optional(),
  config_check_ongoing_interval: z.boolean().optional(),
  subscribed_users: z.array(z.number()),
  created_at: z.string(),
  snoozed_until: z.string().optional().nullable(),
  skip_weekend: z.boolean().optional(),
  detector_config: z.record(z.string(), z.unknown()).optional().nullable(),
  schedule_restriction: z.record(z.string(), z.unknown()).optional().nullable(),
  investigation_agent_enabled: z.boolean().optional(),
  investigation_gates_notifications: z.boolean().optional(),
  investigation_inconclusive_action: z.string().optional(),
});

export function createAlertTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_create_alert',
    description: 'Create an alert on an insight in PostHog.',
    inputSchema: createAlertInputSchema,
    outputSchema: createAlertOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createAlertOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const thresholdBounds: { lower?: number; upper?: number } = {};
      if (input.threshold_lower !== undefined && input.threshold_lower !== null) {
        thresholdBounds.lower = input.threshold_lower;
      }
      if (input.threshold_upper !== undefined && input.threshold_upper !== null) {
        thresholdBounds.upper = input.threshold_upper;
      }

      const response = await platformProxy.post({
        // https://posthog.com/docs/api/alerts#create-alerts
        endpoint: `/api/projects/${encodeURIComponent(input.project_id)}/alerts/`,
        data: {
          insight: input.insight,
          name: input.name,
          condition: {
            type: input.condition_type,
          },
          threshold: {
            configuration: {
              type: input.threshold_type,
              ...(Object.keys(thresholdBounds).length > 0 && { bounds: thresholdBounds }),
            },
          },
          config: {
            type: 'TrendsAlertConfig',
            series_index: input.config_series_index ?? 0,
            check_ongoing_interval: input.config_check_ongoing_interval ?? false,
          },
          calculation_interval: input.calculation_interval ?? 'daily',
          subscribed_users: input.subscribed_users ?? [],
          ...(input.enabled !== undefined && { enabled: input.enabled }),
          ...(input.skip_weekend !== undefined && { skip_weekend: input.skip_weekend }),
          ...(input.snoozed_until !== undefined &&
            input.snoozed_until !== null && { snoozed_until: input.snoozed_until }),
          ...(input.detector_config !== undefined &&
            input.detector_config !== null && { detector_config: input.detector_config }),
          ...(input.schedule_restriction !== undefined &&
            input.schedule_restriction !== null && { schedule_restriction: input.schedule_restriction }),
          ...(input.investigation_agent_enabled !== undefined && {
            investigation_agent_enabled: input.investigation_agent_enabled,
          }),
          ...(input.investigation_gates_notifications !== undefined && {
            investigation_gates_notifications: input.investigation_gates_notifications,
          }),
          ...(input.investigation_inconclusive_action !== undefined && {
            investigation_inconclusive_action: input.investigation_inconclusive_action,
          }),
        },
        retries: 3,
      });

      const providerAlert = ProviderAlertSchema.parse(response.data);

      const insightId = typeof providerAlert.insight === 'number' ? providerAlert.insight : providerAlert.insight.id;

      return {
        id: providerAlert.id,
        name: providerAlert.name,
        insight_id: insightId,
        state: providerAlert.state,
        enabled: providerAlert.enabled,
        calculation_interval: providerAlert.calculation_interval,
        ...(providerAlert.condition?.type !== undefined && { condition_type: providerAlert.condition.type }),
        ...(providerAlert.threshold?.configuration?.type !== undefined && {
          threshold_type: providerAlert.threshold.configuration.type,
        }),
        ...(providerAlert.threshold?.configuration?.bounds?.lower !== undefined && {
          threshold_lower: providerAlert.threshold.configuration.bounds.lower,
        }),
        ...(providerAlert.threshold?.configuration?.bounds?.upper !== undefined && {
          threshold_upper: providerAlert.threshold.configuration.bounds.upper,
        }),
        ...(providerAlert.config?.series_index !== undefined && {
          config_series_index: providerAlert.config.series_index,
        }),
        ...(providerAlert.config?.check_ongoing_interval !== undefined && {
          config_check_ongoing_interval: providerAlert.config.check_ongoing_interval,
        }),
        subscribed_users: providerAlert.subscribed_users,
        created_at: providerAlert.created_at,
        ...(providerAlert.snoozed_until !== undefined && { snoozed_until: providerAlert.snoozed_until }),
        ...(providerAlert.skip_weekend !== undefined && { skip_weekend: providerAlert.skip_weekend }),
        ...(providerAlert.detector_config !== undefined && { detector_config: providerAlert.detector_config }),
        ...(providerAlert.schedule_restriction !== undefined && {
          schedule_restriction: providerAlert.schedule_restriction,
        }),
        ...(providerAlert.investigation_agent_enabled !== undefined && {
          investigation_agent_enabled: providerAlert.investigation_agent_enabled,
        }),
        ...(providerAlert.investigation_gates_notifications !== undefined && {
          investigation_gates_notifications: providerAlert.investigation_gates_notifications,
        }),
        ...(providerAlert.investigation_inconclusive_action !== undefined && {
          investigation_inconclusive_action: providerAlert.investigation_inconclusive_action,
        }),
      };
    },
  });
}
