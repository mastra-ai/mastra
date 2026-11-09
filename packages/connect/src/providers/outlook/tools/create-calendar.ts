// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const CalendarColorEnumSchema = z.enum([
  'lightBlue',
  'lightGreen',
  'lightOrange',
  'lightGray',
  'lightYellow',
  'lightTeal',
  'lightPink',
  'lightBrown',
  'lightRed',
  'maxColor',
]);

export const createCalendarInputSchema = z.object({
  name: z.string().min(1).describe('Name of the new calendar. Example: "Team Events"'),
  color: CalendarColorEnumSchema.optional().describe('Color theme for the calendar. Example: "lightBlue"'),
});

const ProviderCalendarSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.union([z.string(), z.number()]).nullable(),
  canShare: z.boolean().optional(),
  canViewPrivateItems: z.boolean().optional(),
  isDefaultCalendar: z.boolean().optional(),
  isTallyingResponses: z.boolean().optional(),
  owner: z
    .object({
      name: z.string().optional(),
      address: z.string().optional(),
    })
    .optional(),
});

export const createCalendarOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.union([z.string(), z.number()]).optional(),
  canShare: z.boolean().optional(),
  canViewPrivateItems: z.boolean().optional(),
  isDefaultCalendar: z.boolean().optional(),
  isTallyingResponses: z.boolean().optional(),
  ownerName: z.string().optional(),
  ownerAddress: z.string().optional(),
});

export function createCalendarTool(proxy: PlatformProxy) {
  return createTool({
    id: 'outlook_create_calendar',
    description: 'Create a secondary calendar in the mailbox.',
    inputSchema: createCalendarInputSchema,
    outputSchema: createCalendarOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createCalendarOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://learn.microsoft.com/graph/api/user-post-calendars
      const response = await platformProxy.post({
        endpoint: '/v1.0/me/calendars',
        data: {
          name: input.name,
          ...(input.color !== undefined && { color: input.color }),
        },
        retries: 3,
      });

      const calendar = ProviderCalendarSchema.parse(response.data);

      return {
        id: calendar.id,
        name: calendar.name,
        ...(calendar.color != null && { color: calendar.color }),
        ...(calendar.canShare !== undefined && { canShare: calendar.canShare }),
        ...(calendar.canViewPrivateItems !== undefined && { canViewPrivateItems: calendar.canViewPrivateItems }),
        ...(calendar.isDefaultCalendar !== undefined && { isDefaultCalendar: calendar.isDefaultCalendar }),
        ...(calendar.isTallyingResponses !== undefined && { isTallyingResponses: calendar.isTallyingResponses }),
        ...(calendar.owner?.name !== undefined && { ownerName: calendar.owner.name }),
        ...(calendar.owner?.address !== undefined && { ownerAddress: calendar.owner.address }),
      };
    },
  });
}
