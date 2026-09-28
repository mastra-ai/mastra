// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const listAlertsInputSchema = z.object({
  project_id: z.string().describe('PostHog project ID. Example: "309484"'),
  cursor: z.string().optional().describe('Pagination offset from the previous response. Omit for the first page.'),
  limit: z.number().int().min(1).max(100).optional().describe('Number of results per page. Example: 10'),
});

const ProviderAlertSchema = z.object({
  id: z.string(),
  created_at: z.string().optional(),
  insight: z.unknown().optional(),
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  state: z.string().optional(),
  last_notified_at: z.string().nullable().optional(),
  last_checked_at: z.string().nullable().optional(),
  next_check_at: z.string().nullable().optional(),
  checks_total: z.number().optional(),
  last_value: z.number().nullable().optional(),
  calculation_interval: z.string().optional(),
  snoozed_until: z.string().nullable().optional(),
  skip_weekend: z.boolean().nullable().optional(),
  investigation_agent_enabled: z.boolean().optional(),
  investigation_gates_notifications: z.boolean().optional(),
  investigation_inconclusive_action: z.string().optional(),
});

const ProviderListResponseSchema = z.object({
  count: z.number(),
  next: z.string().nullable().optional(),
  previous: z.string().nullable().optional(),
  results: z.array(z.unknown()),
});

const AlertSchema = z.object({
  id: z.string(),
  created_at: z.string().optional(),
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  state: z.string().optional(),
  last_notified_at: z.string().optional(),
  last_checked_at: z.string().optional(),
  next_check_at: z.string().optional(),
  checks_total: z.number().optional(),
  last_value: z.number().optional(),
  calculation_interval: z.string().optional(),
  snoozed_until: z.string().optional(),
  skip_weekend: z.boolean().optional(),
  investigation_agent_enabled: z.boolean().optional(),
  investigation_gates_notifications: z.boolean().optional(),
  investigation_inconclusive_action: z.string().optional(),
});

export const listAlertsOutputSchema = z.object({
  items: z.array(AlertSchema),
  next_cursor: z.string().optional(),
});

export function listAlertsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'posthog_list_alerts',
    description: 'List alerts from PostHog.',
    inputSchema: listAlertsInputSchema,
    outputSchema: listAlertsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof listAlertsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const projectId = input.project_id;

      const params: Record<string, string> = {};
      if (input.limit !== undefined) {
        params['limit'] = String(input.limit);
      }
      if (input.cursor !== undefined) {
        params['offset'] = input.cursor;
      }

      const response = await platformProxy.get({
        // https://posthog.com/docs/api/alerts
        endpoint: `/api/projects/${encodeURIComponent(projectId)}/alerts/`,
        params,
        retries: 3,
      });

      const providerResponse = ProviderListResponseSchema.parse(response.data);

      const items = providerResponse.results.map(item => {
        const alert = ProviderAlertSchema.parse(item);
        return {
          id: alert.id,
          ...(alert.created_at !== undefined && { created_at: alert.created_at }),
          ...(alert.name !== undefined && { name: alert.name }),
          ...(alert.enabled !== undefined && { enabled: alert.enabled }),
          ...(alert.state !== undefined && { state: alert.state }),
          ...(alert.last_notified_at !== undefined &&
            alert.last_notified_at !== null && { last_notified_at: alert.last_notified_at }),
          ...(alert.last_checked_at !== undefined &&
            alert.last_checked_at !== null && { last_checked_at: alert.last_checked_at }),
          ...(alert.next_check_at !== undefined &&
            alert.next_check_at !== null && { next_check_at: alert.next_check_at }),
          ...(alert.checks_total !== undefined && { checks_total: alert.checks_total }),
          ...(alert.last_value !== undefined && alert.last_value !== null && { last_value: alert.last_value }),
          ...(alert.calculation_interval !== undefined && { calculation_interval: alert.calculation_interval }),
          ...(alert.snoozed_until !== undefined &&
            alert.snoozed_until !== null && { snoozed_until: alert.snoozed_until }),
          ...(alert.skip_weekend !== undefined && alert.skip_weekend !== null && { skip_weekend: alert.skip_weekend }),
          ...(alert.investigation_agent_enabled !== undefined && {
            investigation_agent_enabled: alert.investigation_agent_enabled,
          }),
          ...(alert.investigation_gates_notifications !== undefined && {
            investigation_gates_notifications: alert.investigation_gates_notifications,
          }),
          ...(alert.investigation_inconclusive_action !== undefined && {
            investigation_inconclusive_action: alert.investigation_inconclusive_action,
          }),
        };
      });

      let nextCursor: string | undefined;
      if (providerResponse.next) {
        const offsetMatch = providerResponse.next.match(/[?&]offset=([^&]+)/);
        if (offsetMatch) {
          nextCursor = offsetMatch[1];
        }
      }

      return {
        items,
        ...(nextCursor !== undefined && { next_cursor: nextCursor }),
      };
    },
  });
}
