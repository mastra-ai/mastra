// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getAlertInputSchema = z.object({
  id: z.string().describe('Alert ID. Example: "497f6eca-6276-4993-bfeb-53cbbbba6f08"'),
  project_id: z.string().describe('Project ID. Example: "309484"'),
});

const CreatedBySchema = z.object({
  id: z.number(),
  uuid: z.string(),
  distinct_id: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  email: z.string(),
  is_email_verified: z.boolean().optional(),
  hedgehog_config: z.record(z.string(), z.unknown()).nullish().optional(),
  role_at_organization: z.string().optional(),
});

const InsightSchema = z
  .object({
    id: z.number().optional(),
  })
  .passthrough();

const ThresholdConfigurationSchema = z
  .object({
    type: z.string().optional(),
    bounds: z.unknown().nullish().optional(),
  })
  .passthrough();

const ThresholdSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  name: z.string(),
  configuration: ThresholdConfigurationSchema.optional(),
});

const ConditionSchema = z
  .object({
    type: z.string().optional(),
  })
  .passthrough();

const CheckSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  calculated_value: z.number().optional(),
  state: z.string().optional(),
  targets_notified: z.boolean().optional(),
  anomaly_scores: z.unknown().nullish().optional(),
  triggered_points: z.unknown().nullish().optional(),
  triggered_dates: z.unknown().nullish().optional(),
  interval: z.string().nullish().optional(),
  triggered_metadata: z.unknown().nullish().optional(),
  investigation_status: z.string().nullish().optional(),
  investigation_verdict: z.string().nullish().optional(),
  investigation_summary: z.string().nullish().optional(),
  investigation_notebook_short_id: z.string().nullish().optional(),
  notification_sent_at: z.string().nullish().optional(),
  notification_suppressed_by_agent: z.boolean().optional(),
});

const ConfigSchema = z
  .object({
    type: z.string().optional(),
    series_index: z.number().optional(),
    check_ongoing_interval: z.unknown().nullish().optional(),
  })
  .passthrough();

const DetectorSchema = z.object({
  preprocessing: z.unknown().nullish().optional(),
  threshold: z.unknown().nullish().optional(),
  type: z.string().optional(),
  window: z.unknown().nullish().optional(),
});

const DetectorConfigSchema = z
  .object({
    detectors: z.array(DetectorSchema).optional(),
    operator: z.string().optional(),
    type: z.string().optional(),
  })
  .passthrough();

const BlockedWindowSchema = z.object({
  start: z.string().optional(),
  end: z.string().optional(),
});

const ScheduleRestrictionSchema = z
  .object({
    blocked_windows: z.array(BlockedWindowSchema).optional(),
  })
  .passthrough();

export const getAlertOutputSchema = z.object({
  id: z.string(),
  created_by: CreatedBySchema.optional(),
  created_at: z.string().optional(),
  insight: InsightSchema.optional(),
  name: z.string().optional(),
  subscribed_users: z.array(z.number()).optional(),
  threshold: ThresholdSchema.optional(),
  condition: ConditionSchema.optional(),
  state: z.string().optional(),
  enabled: z.boolean().optional(),
  last_notified_at: z.string().nullish().optional(),
  last_checked_at: z.string().optional(),
  next_check_at: z.string().optional(),
  checks: z.array(CheckSchema).optional(),
  checks_total: z.number().optional(),
  config: ConfigSchema.optional(),
  detector_config: DetectorConfigSchema.nullish().optional(),
  calculation_interval: z.string().optional(),
  snoozed_until: z.string().nullish().optional(),
  skip_weekend: z.boolean().nullish().optional(),
  schedule_restriction: ScheduleRestrictionSchema.nullish().optional(),
  last_value: z.number().nullish().optional(),
  investigation_agent_enabled: z.boolean().optional(),
  investigation_gates_notifications: z.boolean().optional(),
  investigation_inconclusive_action: z.string().optional(),
});

export function getAlertTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_get_alert',
    description: 'Retrieve a single alert from PostHog.',
    inputSchema: getAlertInputSchema,
    outputSchema: getAlertOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getAlertOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://posthog.com/docs/api/alerts
        endpoint: `/api/projects/${encodeURIComponent(input.project_id)}/alerts/${encodeURIComponent(input.id)}/`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Alert not found',
          alert_id: input.id,
          project_id: input.project_id,
        });
      }

      const providerAlert = getAlertOutputSchema.parse(response.data);
      return providerAlert;
    },
  });
}
