// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const getEventInputSchema = z.object({
  eventId: z.string().describe('The unique identifier of the event. Example: "AAMkAGI1AAAoZDOFAAA="'),
  timezone: z
    .string()
    .optional()
    .describe('The time zone to use for returning event dates. Example: "Pacific Standard Time"'),
  select: z
    .string()
    .optional()
    .describe('A comma-separated list of properties to include in the response. Example: "subject,start,end,location"'),
});

const DateTimeTimeZoneSchema = z.object({
  dateTime: z.string(),
  timeZone: z.string(),
});

const LocationSchema = z.object({
  displayName: z.string().optional(),
  locationType: z.string().optional(),
  uniqueId: z.string().optional(),
  uniqueIdType: z.string().optional(),
});

const RecipientSchema = z.object({
  emailAddress: z
    .object({
      name: z.string().optional(),
      address: z.string().optional(),
    })
    .optional(),
});

const ResponseStatusSchema = z.object({
  response: z.string().optional(),
  time: z.string().optional(),
});

const AttendeeSchema = z.object({
  type: z.string().optional(),
  status: ResponseStatusSchema.optional(),
  emailAddress: z
    .object({
      name: z.string().optional(),
      address: z.string().optional(),
    })
    .optional(),
});

const ProviderEventSchema = z.object({
  id: z.string(),
  subject: z.string().nullish(),
  bodyPreview: z.string().nullish(),
  body: z
    .object({
      contentType: z.string().nullish(),
      content: z.string().nullish(),
    })
    .nullish(),
  start: DateTimeTimeZoneSchema.nullish(),
  end: DateTimeTimeZoneSchema.nullish(),
  location: LocationSchema.nullish(),
  locations: z.array(LocationSchema).nullish(),
  attendees: z.array(AttendeeSchema).nullish(),
  organizer: RecipientSchema.nullish(),
  isOrganizer: z.boolean().nullish(),
  isCancelled: z.boolean().nullish(),
  isAllDay: z.boolean().nullish(),
  importance: z.string().nullish(),
  showAs: z.string().nullish(),
  sensitivity: z.string().nullish(),
  recurrence: z
    .object({
      pattern: z
        .object({
          type: z.string().nullish(),
          interval: z.number().nullish(),
          month: z.number().nullish(),
          dayOfMonth: z.number().nullish(),
          daysOfWeek: z.array(z.string()).nullish(),
          firstDayOfWeek: z.string().nullish(),
          index: z.string().nullish(),
        })
        .nullish(),
      range: z
        .object({
          type: z.string().nullish(),
          startDate: z.string().nullish(),
          endDate: z.string().nullish(),
          numberOfOccurrences: z.number().nullish(),
        })
        .nullish(),
    })
    .nullish(),
  seriesMasterId: z.string().nullish(),
  type: z.string().nullish(),
  webLink: z.string().nullish(),
  onlineMeetingUrl: z.string().nullish(),
  createdDateTime: z.string().nullish(),
  lastModifiedDateTime: z.string().nullish(),
  iCalUId: z.string().nullish(),
  responseStatus: ResponseStatusSchema.nullish(),
});

export const getEventOutputSchema = z.object({
  id: z.string(),
  subject: z.string().nullish(),
  bodyPreview: z.string().nullish(),
  bodyContentType: z.string().nullish(),
  bodyContent: z.string().nullish(),
  start: z
    .object({
      dateTime: z.string().optional(),
      timeZone: z.string().optional(),
    })
    .nullish(),
  end: z
    .object({
      dateTime: z.string().optional(),
      timeZone: z.string().optional(),
    })
    .nullish(),
  locationDisplayName: z.string().nullish(),
  locationType: z.string().nullish(),
  locations: z
    .array(
      z.object({
        displayName: z.string().nullish(),
        locationType: z.string().nullish(),
        uniqueId: z.string().nullish(),
        uniqueIdType: z.string().nullish(),
      }),
    )
    .nullish(),
  attendees: z
    .array(
      z.object({
        type: z.string().nullish(),
        response: z.string().nullish(),
        emailName: z.string().nullish(),
        emailAddress: z.string().nullish(),
      }),
    )
    .nullish(),
  organizerName: z.string().nullish(),
  organizerAddress: z.string().nullish(),
  isOrganizer: z.boolean().nullish(),
  isCancelled: z.boolean().nullish(),
  isAllDay: z.boolean().nullish(),
  importance: z.string().nullish(),
  showAs: z.string().nullish(),
  sensitivity: z.string().nullish(),
  recurrence: z
    .object({
      pattern: z
        .object({
          type: z.string().nullish(),
          interval: z.number().nullish(),
          month: z.number().nullish(),
          dayOfMonth: z.number().nullish(),
          daysOfWeek: z.array(z.string()).nullish(),
          firstDayOfWeek: z.string().nullish(),
          index: z.string().nullish(),
        })
        .nullish(),
      range: z
        .object({
          type: z.string().nullish(),
          startDate: z.string().nullish(),
          endDate: z.string().nullish(),
          numberOfOccurrences: z.number().nullish(),
        })
        .nullish(),
    })
    .nullish(),
  seriesMasterId: z.string().nullish(),
  type: z.string().nullish(),
  webLink: z.string().nullish(),
  onlineMeetingUrl: z.string().nullish(),
  createdDateTime: z.string().nullish(),
  lastModifiedDateTime: z.string().nullish(),
  iCalUId: z.string().nullish(),
  response: z.string().nullish(),
  responseTime: z.string().nullish(),
});

export function getEventTool(proxy: PlatformProxy) {
  return createTool({
    id: 'outlook_get_event',
    description: "Retrieve an event by ID from the user's calendar",
    inputSchema: getEventInputSchema,
    outputSchema: getEventOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof getEventOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const params: Record<string, string> = {};
      if (input['select']) {
        params['$select'] = input['select'];
      }

      const headers: Record<string, string> = {};
      if (input.timezone) {
        headers['Prefer'] = `outlook.timezone="${input.timezone}"`;
      }

      // https://learn.microsoft.com/graph/api/event-get
      const response = await platformProxy.get({
        endpoint: `/v1.0/me/events/${encodeURIComponent(input.eventId)}`,
        params,
        headers,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'not_found',
          message: 'Event not found',
          eventId: input.eventId,
        });
      }

      const providerEvent = ProviderEventSchema.parse(response.data);

      return {
        id: providerEvent.id,
        subject: providerEvent.subject,
        bodyPreview: providerEvent.bodyPreview,
        bodyContentType: providerEvent.body?.contentType,
        bodyContent: providerEvent.body?.content,
        start: providerEvent.start
          ? {
              dateTime: providerEvent.start.dateTime,
              timeZone: providerEvent.start.timeZone,
            }
          : undefined,
        end: providerEvent.end
          ? {
              dateTime: providerEvent.end.dateTime,
              timeZone: providerEvent.end.timeZone,
            }
          : undefined,
        locationDisplayName: providerEvent.location?.displayName,
        locationType: providerEvent.location?.locationType,
        locations: providerEvent.locations
          ? providerEvent.locations.map(loc => ({
              displayName: loc.displayName,
              locationType: loc.locationType,
              uniqueId: loc.uniqueId,
              uniqueIdType: loc.uniqueIdType,
            }))
          : undefined,
        attendees: providerEvent.attendees
          ? providerEvent.attendees.map(att => ({
              type: att.type,
              response: att.status?.response,
              emailName: att.emailAddress?.name,
              emailAddress: att.emailAddress?.address,
            }))
          : undefined,
        organizerName: providerEvent.organizer?.emailAddress?.name,
        organizerAddress: providerEvent.organizer?.emailAddress?.address,
        isOrganizer: providerEvent.isOrganizer,
        isCancelled: providerEvent.isCancelled,
        isAllDay: providerEvent.isAllDay,
        importance: providerEvent.importance,
        showAs: providerEvent.showAs,
        sensitivity: providerEvent.sensitivity,
        recurrence: providerEvent.recurrence,
        seriesMasterId: providerEvent.seriesMasterId,
        type: providerEvent.type,
        webLink: providerEvent.webLink,
        onlineMeetingUrl: providerEvent.onlineMeetingUrl,
        createdDateTime: providerEvent.createdDateTime,
        lastModifiedDateTime: providerEvent.lastModifiedDateTime,
        iCalUId: providerEvent.iCalUId,
        response: providerEvent.responseStatus?.response,
        responseTime: providerEvent.responseStatus?.time,
      };
    },
  });
}
