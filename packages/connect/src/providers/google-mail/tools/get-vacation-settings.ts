// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getVacationSettingsInputSchema = z.object({});

const ProviderVacationSettingsSchema = z.object({
  enableAutoReply: z.boolean(),
  responseSubject: z.string().optional(),
  responseBodyPlainText: z.string().optional(),
  responseBodyHtml: z.string().optional(),
  restrictToContacts: z.boolean().optional(),
  restrictToDomain: z.boolean().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
});

export const getVacationSettingsOutputSchema = z.object({
  enableAutoReply: z.boolean(),
  responseSubject: z.string().optional(),
  responseBodyPlainText: z.string().optional(),
  responseBodyHtml: z.string().optional(),
  restrictToContacts: z.boolean().optional(),
  restrictToDomain: z.boolean().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
});

export function getVacationSettingsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_get_vacation_settings',
    description: 'Retrieve the mailbox vacation responder settings.',
    inputSchema: getVacationSettingsInputSchema,
    outputSchema: getVacationSettingsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getVacationSettingsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.settings/getVacation
      const response = await platformProxy.get({
        endpoint: '/gmail/v1/users/me/settings/vacation',
        retries: 3,
      });

      const vacationSettings = ProviderVacationSettingsSchema.parse(response.data);

      return {
        enableAutoReply: vacationSettings.enableAutoReply,
        ...(vacationSettings.responseSubject !== undefined && { responseSubject: vacationSettings.responseSubject }),
        ...(vacationSettings.responseBodyPlainText !== undefined && {
          responseBodyPlainText: vacationSettings.responseBodyPlainText,
        }),
        ...(vacationSettings.responseBodyHtml !== undefined && { responseBodyHtml: vacationSettings.responseBodyHtml }),
        ...(vacationSettings.restrictToContacts !== undefined && {
          restrictToContacts: vacationSettings.restrictToContacts,
        }),
        ...(vacationSettings.restrictToDomain !== undefined && { restrictToDomain: vacationSettings.restrictToDomain }),
        ...(vacationSettings.startTime !== undefined && { startTime: vacationSettings.startTime }),
        ...(vacationSettings.endTime !== undefined && { endTime: vacationSettings.endTime }),
      };
    },
  });
}
