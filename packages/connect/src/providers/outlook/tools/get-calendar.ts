// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getCalendarInputSchema = z.object({
  calendarId: z.string().describe('The unique identifier of the calendar. Example: "AAMkAGI2TGuLAAA="'),
});

const ProviderCalendarSchema = z.object({
  id: z.string(),
  name: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  isDefaultCalendar: z.boolean().optional().nullable(),
  changeKey: z.string().optional().nullable(),
  canShare: z.boolean().optional().nullable(),
  canViewPrivateItems: z.boolean().optional().nullable(),
  hexColor: z.string().optional().nullable(),
  canEdit: z.boolean().optional().nullable(),
  allowedOnlineMeetingProviders: z.array(z.string()).optional().nullable(),
  defaultOnlineMeetingProvider: z.string().optional().nullable(),
  isTallyingResponses: z.boolean().optional().nullable(),
  isRemovable: z.boolean().optional().nullable(),
  owner: z
    .object({
      name: z.string().optional().nullable(),
      address: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
});

export const getCalendarOutputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  color: z.string().optional(),
  isDefaultCalendar: z.boolean().optional(),
  changeKey: z.string().optional(),
  canShare: z.boolean().optional(),
  canViewPrivateItems: z.boolean().optional(),
  hexColor: z.string().optional(),
  canEdit: z.boolean().optional(),
  allowedOnlineMeetingProviders: z.array(z.string()).optional(),
  defaultOnlineMeetingProvider: z.string().optional(),
  isTallyingResponses: z.boolean().optional(),
  isRemovable: z.boolean().optional(),
  owner: z
    .object({
      name: z.string().optional(),
      address: z.string().optional(),
    })
    .optional(),
});

export function getCalendarTool(proxy: PlatformProxy) {
  return createTool({
    id: 'outlook_get_calendar',
    description: 'Retrieve a calendar by ID.',
    inputSchema: getCalendarInputSchema,
    outputSchema: getCalendarOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getCalendarOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://learn.microsoft.com/graph/api/calendar-get
      const response = await platformProxy.get({
        endpoint: `/v1.0/me/calendars/${encodeURIComponent(input.calendarId)}`,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: `Calendar not found: ${input.calendarId}`,
          calendarId: input.calendarId,
        });
      }

      const providerCalendar = ProviderCalendarSchema.parse(response.data);

      return {
        id: providerCalendar.id,
        ...(providerCalendar.name != null && { name: providerCalendar.name }),
        ...(providerCalendar.color != null && { color: providerCalendar.color }),
        ...(providerCalendar.isDefaultCalendar != null && {
          isDefaultCalendar: providerCalendar.isDefaultCalendar,
        }),
        ...(providerCalendar.changeKey != null && { changeKey: providerCalendar.changeKey }),
        ...(providerCalendar.canShare != null && { canShare: providerCalendar.canShare }),
        ...(providerCalendar.canViewPrivateItems != null && {
          canViewPrivateItems: providerCalendar.canViewPrivateItems,
        }),
        ...(providerCalendar.hexColor != null && { hexColor: providerCalendar.hexColor }),
        ...(providerCalendar.canEdit != null && { canEdit: providerCalendar.canEdit }),
        ...(providerCalendar.allowedOnlineMeetingProviders != null && {
          allowedOnlineMeetingProviders: providerCalendar.allowedOnlineMeetingProviders,
        }),
        ...(providerCalendar.defaultOnlineMeetingProvider != null && {
          defaultOnlineMeetingProvider: providerCalendar.defaultOnlineMeetingProvider,
        }),
        ...(providerCalendar.isTallyingResponses != null && {
          isTallyingResponses: providerCalendar.isTallyingResponses,
        }),
        ...(providerCalendar.isRemovable != null && { isRemovable: providerCalendar.isRemovable }),
        ...(providerCalendar.owner != null && {
          owner: {
            ...(providerCalendar.owner.name != null && {
              name: providerCalendar.owner.name,
            }),
            ...(providerCalendar.owner.address != null && {
              address: providerCalendar.owner.address,
            }),
          },
        }),
      };
    },
  });
}
