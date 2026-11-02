// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const createEventInputSchema = z.object({
  calendarId: z
    .string()
    .optional()
    .describe('Calendar ID. If omitted, the event is created in the default calendar. Example: "AQMkAGI2..."'),
  subject: z.string().describe('Event subject/title. Example: "Team Meeting"'),
  start: z.object({
    dateTime: z.string().describe('Start time in ISO 8601 format. Example: "2024-06-15T10:00:00"'),
    timeZone: z.string().describe('Time zone for start time. Example: "UTC" or "Pacific Standard Time"'),
  }),
  end: z.object({
    dateTime: z.string().describe('End time in ISO 8601 format. Example: "2024-06-15T11:00:00"'),
    timeZone: z.string().describe('Time zone for end time. Example: "UTC" or "Pacific Standard Time"'),
  }),
  body: z
    .object({
      contentType: z.enum(['text', 'html']).optional().describe('Body content type.'),
      content: z.string().describe('Event body/description content.'),
    })
    .optional(),
  location: z
    .object({
      displayName: z.string().describe('Location display name. Example: "Conference Room A"'),
    })
    .optional(),
  attendees: z
    .array(
      z.object({
        emailAddress: z.object({
          address: z.string().describe('Attendee email address. Example: "user@example.com"'),
          name: z.string().optional().describe('Attendee display name.'),
        }),
        type: z.enum(['required', 'optional', 'resource']).optional(),
      }),
    )
    .optional()
    .describe('List of attendees to invite to the event.'),
  isOnlineMeeting: z.boolean().optional().describe('Whether to create an online meeting (Teams).'),
  onlineMeetingProvider: z
    .enum(['teamsForBusiness', 'skypeForBusiness', 'skypeForConsumer', 'unknown'])
    .optional()
    .describe('Online meeting provider.'),
  sensitivity: z.enum(['normal', 'personal', 'private', 'confidential']).optional(),
  showAs: z.enum(['free', 'tentative', 'busy', 'oof', 'workingElsewhere', 'unknown']).optional(),
});

const ProviderEventSchema = z.object({
  id: z.string(),
  subject: z.string().optional(),
  start: z
    .object({
      dateTime: z.string(),
      timeZone: z.string(),
    })
    .optional(),
  end: z
    .object({
      dateTime: z.string(),
      timeZone: z.string(),
    })
    .optional(),
  body: z
    .object({
      contentType: z.string().optional(),
      content: z.string().optional(),
    })
    .optional(),
  location: z
    .object({
      displayName: z.string().optional(),
    })
    .optional(),
  attendees: z
    .array(
      z.object({
        emailAddress: z
          .object({
            address: z.string().optional(),
            name: z.string().optional(),
          })
          .optional(),
        status: z
          .object({
            response: z
              .enum(['none', 'organizer', 'tentativelyAccepted', 'accepted', 'declined', 'notResponded'])
              .or(z.string())
              .optional(),
            time: z.string().optional(),
          })
          .optional(),
        type: z.enum(['required', 'optional', 'resource']).or(z.string()).optional(),
      }),
    )
    .optional(),
  isOnlineMeeting: z.boolean().optional(),
  onlineMeeting: z
    .object({
      joinUrl: z.string().optional(),
    })
    .nullish(),
  webLink: z.string().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
});

export const createEventOutputSchema = z.object({
  id: z.string(),
  subject: z.string().optional(),
  start: z
    .object({
      dateTime: z.string(),
      timeZone: z.string(),
    })
    .optional(),
  end: z
    .object({
      dateTime: z.string(),
      timeZone: z.string(),
    })
    .optional(),
  body: z
    .object({
      contentType: z.string().optional(),
      content: z.string().optional(),
    })
    .optional(),
  location: z
    .object({
      displayName: z.string().optional(),
    })
    .optional(),
  attendees: z
    .array(
      z.object({
        emailAddress: z
          .object({
            address: z.string().optional(),
            name: z.string().optional(),
          })
          .optional(),
        type: z.enum(['required', 'optional', 'resource']).or(z.string()).optional(),
      }),
    )
    .optional(),
  isOnlineMeeting: z.boolean().optional(),
  onlineMeeting: z
    .object({
      joinUrl: z.string().optional(),
    })
    .nullish(),
  webLink: z.string().optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
});

export function createEventTool(proxy: PlatformProxy) {
  return createTool({
    id: 'outlook_create_event',
    description: 'Create an event on a calendar.',
    inputSchema: createEventInputSchema,
    outputSchema: createEventOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof createEventOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const requestBody: Record<string, unknown> = {
        subject: input.subject,
        start: input.start,
        end: input.end,
      };

      if (input.body !== undefined) {
        requestBody['body'] = input.body;
      }
      if (input.location !== undefined) {
        requestBody['location'] = input.location;
      }
      if (input.attendees !== undefined) {
        requestBody['attendees'] = input.attendees;
      }
      if (input.isOnlineMeeting !== undefined) {
        requestBody['isOnlineMeeting'] = input.isOnlineMeeting;
      }
      if (input.onlineMeetingProvider !== undefined) {
        requestBody['onlineMeetingProvider'] = input.onlineMeetingProvider;
      }
      if (input.sensitivity !== undefined) {
        requestBody['sensitivity'] = input.sensitivity;
      }
      if (input.showAs !== undefined) {
        requestBody['showAs'] = input.showAs;
      }

      // Build endpoint based on whether calendarId is provided
      // https://learn.microsoft.com/graph/api/calendar-post-events
      const endpoint = input.calendarId
        ? `/v1.0/me/calendars/${encodeURIComponent(input.calendarId)}/events`
        : '/v1.0/me/events';

      const response = await platformProxy.post({
        // https://learn.microsoft.com/graph/api/calendar-post-events
        endpoint,
        data: requestBody,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'provider_error',
          message: 'Failed to create event: no response data from Microsoft Graph API',
        });
      }

      const providerEvent = ProviderEventSchema.parse(response.data);

      return {
        id: providerEvent.id,
        subject: providerEvent.subject,
        start: providerEvent.start,
        end: providerEvent.end,
        body: providerEvent.body,
        location: providerEvent.location,
        attendees: providerEvent.attendees,
        isOnlineMeeting: providerEvent.isOnlineMeeting,
        onlineMeeting: providerEvent.onlineMeeting,
        webLink: providerEvent.webLink,
        createdDateTime: providerEvent.createdDateTime,
        lastModifiedDateTime: providerEvent.lastModifiedDateTime,
      };
    },
  });
}
