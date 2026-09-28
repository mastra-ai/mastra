// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateVacationSettingsInputSchema = z.object({
  enableAutoReply: z.boolean().describe('Flag that controls whether Gmail automatically replies to messages.'),
  responseSubject: z
    .string()
    .optional()
    .describe(
      'Optional text to prepend to the subject line in vacation responses. Either this or responseBody must be nonempty to enable auto-replies.',
    ),
  responseBodyPlainText: z
    .string()
    .optional()
    .describe(
      'Response body in plain text format. If both responseBodyPlainText and responseBodyHtml are specified, responseBodyHtml will be used.',
    ),
  responseBodyHtml: z
    .string()
    .optional()
    .describe(
      'Response body in HTML format. Gmail will sanitize the HTML before storing it. If both responseBodyPlainText and responseBodyHtml are specified, responseBodyHtml will be used.',
    ),
  restrictToContacts: z
    .boolean()
    .optional()
    .describe(
      "Flag that determines whether responses are sent to recipients who are not in the user's list of contacts.",
    ),
  restrictToDomain: z
    .boolean()
    .optional()
    .describe(
      "Flag that determines whether responses are sent to recipients who are outside of the user's domain. This feature is only available for Google Workspace users.",
    ),
  startTime: z
    .string()
    .optional()
    .describe(
      'An optional start time for sending auto-replies (epoch milliseconds as a string). When this is specified, Gmail will automatically reply only to messages that it receives after the start time.',
    ),
  endTime: z
    .string()
    .optional()
    .describe(
      'An optional end time for sending auto-replies (epoch milliseconds as a string). When this is specified, Gmail will automatically reply only to messages that it receives before the end time. If both startTime and endTime are specified, startTime must precede endTime.',
    ),
});

export const updateVacationSettingsOutputSchema = z.object({
  enableAutoReply: z.boolean(),
  responseSubject: z.string().optional(),
  responseBodyPlainText: z.string().optional(),
  responseBodyHtml: z.string().optional(),
  restrictToContacts: z.boolean().optional(),
  restrictToDomain: z.boolean().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
});

export function updateVacationSettingsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_mail_update_vacation_settings',
    description: 'Update the mailbox vacation responder configuration.',
    inputSchema: updateVacationSettingsInputSchema,
    outputSchema: updateVacationSettingsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateVacationSettingsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // Build the request body from input fields
      interface VacationSettingsRequest {
        enableAutoReply: boolean;
        responseSubject?: string;
        responseBodyPlainText?: string;
        responseBodyHtml?: string;
        restrictToContacts?: boolean;
        restrictToDomain?: boolean;
        startTime?: string;
        endTime?: string;
      }

      const requestBody: VacationSettingsRequest = {
        enableAutoReply: input.enableAutoReply,
      };

      if (input.responseSubject !== undefined) {
        requestBody.responseSubject = input.responseSubject;
      }
      if (input.responseBodyPlainText !== undefined) {
        requestBody.responseBodyPlainText = input.responseBodyPlainText;
      }
      if (input.responseBodyHtml !== undefined) {
        requestBody.responseBodyHtml = input.responseBodyHtml;
      }
      if (input.restrictToContacts !== undefined) {
        requestBody.restrictToContacts = input.restrictToContacts;
      }
      if (input.restrictToDomain !== undefined) {
        requestBody.restrictToDomain = input.restrictToDomain;
      }
      if (input.startTime !== undefined) {
        requestBody.startTime = input.startTime;
      }
      if (input.endTime !== undefined) {
        requestBody.endTime = input.endTime;
      }

      // https://developers.google.com/gmail/api/reference/rest/v1/users.settings/updateVacation
      const response = await platformProxy.put({
        endpoint: '/gmail/v1/users/me/settings/vacation',
        data: requestBody,
        retries: 3,
      });

      const vacationSettings = updateVacationSettingsOutputSchema.parse(response.data);
      return vacationSettings;
    },
  });
}
