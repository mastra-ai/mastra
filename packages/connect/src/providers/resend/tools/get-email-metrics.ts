// AUTO-GENERATED from rhysbalevicius/integration-templates @ 06fb7396c6b2 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy, PlatformProxyRequest } from '../../../runtime/platform-proxy.js';

export const getEmailMetricsInputSchema = z
  .object({
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    timezone: z.string().optional(),
    granularity: z.enum(['hourly', 'daily', 'weekly', 'monthly']).optional(),
    metrics: z
      .array(
        z.enum([
          'received',
          'delivered',
          'complained',
          'suppressed',
          'bounced',
          'bounced_transient',
          'bounced_permanent',
          'bounced_undetermined',
          'opened',
          'clicked',
          'unsubscribed',
          'delivery_delayed',
          'failed',
          'sent',
          'unique_opened',
          'unique_clicked',
          'delivery_rate',
          'open_rate',
          'click_rate',
          'bounce_rate',
          'complaint_rate',
          'unsubscribe_rate',
        ]),
      )
      .optional(),
    dimensions: z.array(z.enum(['period', 'domain', 'email', 'broadcast'])).optional(),
    domain_id: z.array(z.string()).optional(),
    email_id: z.array(z.string()).optional(),
    broadcast_id: z.array(z.string()).optional(),
  })
  .passthrough();

const ProviderResponseSchema = z
  .object({
    object: z.string().optional(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    metrics: z.array(z.string()).optional(),
    dimensions: z.array(z.enum(['period', 'domain', 'email', 'broadcast']).or(z.string())).optional(),
    granularity: z.enum(['hourly', 'daily', 'weekly', 'monthly']).or(z.string()).optional(),
    totals: z.record(z.string(), z.number()).optional(),
    data: z
      .array(
        z
          .object({
            period: z.string().optional(),
            domain_id: z.string().optional(),
            domain_name: z.string().optional(),
            email_id: z.string().optional(),
            broadcast_id: z.string().optional(),
            broadcast_name: z.string().optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

export const getEmailMetricsOutputSchema = ProviderResponseSchema;

export function getEmailMetricsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'resend_get_email_metrics',
    description: 'Retrieve account-level email metrics in Resend.',
    inputSchema: getEmailMetricsInputSchema,
    outputSchema: getEmailMetricsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getEmailMetricsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string> = {};
      if (input['start_date'] !== undefined) params['start_date'] = String(input['start_date']);
      if (input['end_date'] !== undefined) params['end_date'] = String(input['end_date']);
      if (input['timezone'] !== undefined) params['timezone'] = String(input['timezone']);
      if (input['granularity'] !== undefined) params['granularity'] = String(input['granularity']);
      if (input['metrics'] !== undefined && input['metrics'].length > 0) params['metrics'] = input['metrics'].join(',');
      if (input['dimensions'] !== undefined && input['dimensions'].length > 0)
        params['dimensions'] = input['dimensions'].join(',');
      if (input['domain_id'] !== undefined && input['domain_id'].length > 0)
        params['domain_id'] = input['domain_id'].join(',');
      if (input['email_id'] !== undefined && input['email_id'].length > 0)
        params['email_id'] = input['email_id'].join(',');
      if (input['broadcast_id'] !== undefined && input['broadcast_id'].length > 0)
        params['broadcast_id'] = input['broadcast_id'].join(',');
      const config: PlatformProxyRequest = {
        // https://raw.githubusercontent.com/resend/resend-openapi/68c1b66c20ad62020962838832e53af10558c2f5/resend.yaml,
        endpoint: `/emails/metrics`,
        retries: 3,
        params,
      };
      const response = await platformProxy.get(config);
      const data = ProviderResponseSchema.parse(response.data);
      return data;
    },
  });
}
