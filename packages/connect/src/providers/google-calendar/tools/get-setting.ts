// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getSettingInputSchema = z
  .object({
    settingId: z.string().describe('The ID of the user setting to retrieve. Example: "timezone"'),
  })
  .describe('Input for retrieving a single Google Calendar user setting');

const ProviderSettingSchema = z.object({
  kind: z.string().optional(),
  etag: z.string().optional(),
  id: z.string(),
  value: z.string(),
});

export const getSettingOutputSchema = z
  .object({
    id: z.string().describe('The ID of the user setting'),
    value: z.string().describe('The value of the user setting'),
    kind: z.string().optional().describe('Type of the resource'),
    etag: z.string().optional().describe('ETag of the resource'),
  })
  .describe('A single Google Calendar user setting');

export function getSettingTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_calendar_get_setting',
    description: 'Retrieve a single Google Calendar user setting by ID',
    inputSchema: getSettingInputSchema,
    outputSchema: getSettingOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getSettingOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const response = await platformProxy.get({
        // https://developers.google.com/workspace/calendar/api/v3/reference/settings/get
        endpoint: `/calendar/v3/users/me/settings/${encodeURIComponent(input.settingId)}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: `Setting ${input.settingId} not found`,
        });
      }

      const providerSetting = ProviderSettingSchema.parse(response.data);

      return {
        id: providerSetting.id,
        value: providerSetting.value,
        ...(providerSetting.kind != null && { kind: providerSetting.kind }),
        ...(providerSetting.etag != null && { etag: providerSetting.etag }),
      };
    },
  });
}
