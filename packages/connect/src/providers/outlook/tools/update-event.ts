// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

export const updateEventInputSchema = z.object({
  eventId: z.string().describe('The unique identifier of the event to update. Example: "AAMkAGI1..."'),
  subject: z.string().optional().describe('The subject of the event.'),
  body: z
    .object({
      contentType: z.enum(['text', 'html']).optional(),
      content: z.string().optional(),
    })
    .optional()
    .describe('The body of the event.'),
  attendees: z
    .array(
      z.object({
        emailAddress: z.object({
          address: z.string(),
          name: z.string().optional(),
        }),
        type: z.enum(['required', 'optional', 'resource']).optional(),
      }),
    )
    .optional()
    .describe('The attendees of the event.'),
  start: z
    .object({
      dateTime: z.string().describe('The start date and time in ISO 8601 format.'),
      timeZone: z.string().optional(),
    })
    .optional()
    .describe('The start time of the event.'),
  end: z
    .object({
      dateTime: z.string().describe('The end date and time in ISO 8601 format.'),
      timeZone: z.string().optional(),
    })
    .optional()
    .describe('The end time of the event.'),
  location: z
    .object({
      displayName: z.string().optional(),
      address: z
        .object({
          street: z.string().optional(),
          city: z.string().optional(),
          state: z.string().optional(),
          countryOrRegion: z.string().optional(),
          postalCode: z.string().optional(),
        })
        .optional(),
    })
    .optional()
    .describe('The location of the event.'),
});

const ProviderEventSchema = z.object({
  id: z.string(),
  subject: z.string().nullable().optional(),
  body: z
    .object({
      contentType: z.string().optional(),
      content: z.string().nullable().optional(),
    })
    .optional(),
  attendees: z
    .array(
      z.object({
        emailAddress: z
          .object({
            address: z.string(),
            name: z.string().optional(),
          })
          .optional(),
        type: z.string().optional(),
      }),
    )
    .optional(),
  start: z
    .object({
      dateTime: z.string().optional(),
      timeZone: z.string().optional(),
    })
    .optional(),
  end: z
    .object({
      dateTime: z.string().optional(),
      timeZone: z.string().optional(),
    })
    .optional(),
  location: z
    .object({
      displayName: z.string().nullable().optional(),
      address: z
        .object({
          street: z.string().nullable().optional(),
          city: z.string().nullable().optional(),
          state: z.string().nullable().optional(),
          countryOrRegion: z.string().nullable().optional(),
          postalCode: z.string().nullable().optional(),
        })
        .optional(),
    })
    .optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  webLink: z.string().optional(),
});

export const updateEventOutputSchema = z.object({
  id: z.string(),
  subject: z.string().optional(),
  body: z
    .object({
      contentType: z.string().optional(),
      content: z.string().optional(),
    })
    .optional(),
  attendees: z
    .array(
      z.object({
        emailAddress: z.object({
          address: z.string(),
          name: z.string().optional(),
        }),
        type: z.string().optional(),
      }),
    )
    .optional(),
  start: z
    .object({
      dateTime: z.string().optional(),
      timeZone: z.string().optional(),
    })
    .optional(),
  end: z
    .object({
      dateTime: z.string().optional(),
      timeZone: z.string().optional(),
    })
    .optional(),
  location: z
    .object({
      displayName: z.string().optional(),
      address: z
        .object({
          street: z.string().optional(),
          city: z.string().optional(),
          state: z.string().optional(),
          countryOrRegion: z.string().optional(),
          postalCode: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  createdDateTime: z.string().optional(),
  lastModifiedDateTime: z.string().optional(),
  webLink: z.string().optional(),
});

export function updateEventTool(proxy: PlatformProxy) {
  return createTool({
    id: 'outlook_update_event',
    description: 'Update event details in Outlook calendar.',
    inputSchema: updateEventInputSchema,
    outputSchema: updateEventOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof updateEventOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      const updateData: Record<string, unknown> = {};

      if (input.subject !== undefined) {
        updateData['subject'] = input.subject;
      }
      if (input.body !== undefined) {
        updateData['body'] = input.body;
      }
      if (input.attendees !== undefined) {
        updateData['attendees'] = input.attendees;
      }
      if (input.start !== undefined) {
        updateData['start'] = input.start;
      }
      if (input.end !== undefined) {
        updateData['end'] = input.end;
      }
      if (input.location !== undefined) {
        updateData['location'] = input.location;
      }

      // https://learn.microsoft.com/graph/api/event-update
      const response = await platformProxy.patch({
        endpoint: `/v1.0/me/events/${encodeURIComponent(input.eventId)}`,
        data: updateData,
        retries: 3,
      });

      if (!response.data) {
        throw new platformProxy.ActionError({
          type: 'update_failed',
          message: 'Failed to update event',
          eventId: input.eventId,
        });
      }

      const providerEvent = ProviderEventSchema.parse(response.data);

      return {
        id: providerEvent.id,
        ...(providerEvent.subject !== null &&
          providerEvent.subject !== undefined && { subject: providerEvent.subject }),
        ...(providerEvent.body && {
          body: {
            contentType: providerEvent.body.contentType,
            ...(providerEvent.body.content !== null &&
              providerEvent.body.content !== undefined && {
                content: providerEvent.body.content,
              }),
          },
        }),
        ...(providerEvent.attendees && {
          attendees: providerEvent.attendees.map(attendee => ({
            emailAddress: attendee.emailAddress || { address: '' },
            type: attendee.type,
          })),
        }),
        ...(providerEvent.start && { start: providerEvent.start }),
        ...(providerEvent.end && { end: providerEvent.end }),
        ...(providerEvent.location && {
          location: {
            ...(providerEvent.location.displayName !== null &&
              providerEvent.location.displayName !== undefined && {
                displayName: providerEvent.location.displayName,
              }),
            ...(providerEvent.location.address && {
              address: {
                ...(providerEvent.location.address.street !== null &&
                  providerEvent.location.address.street !== undefined && {
                    street: providerEvent.location.address.street,
                  }),
                ...(providerEvent.location.address.city !== null &&
                  providerEvent.location.address.city !== undefined && {
                    city: providerEvent.location.address.city,
                  }),
                ...(providerEvent.location.address.state !== null &&
                  providerEvent.location.address.state !== undefined && {
                    state: providerEvent.location.address.state,
                  }),
                ...(providerEvent.location.address.countryOrRegion !== null &&
                  providerEvent.location.address.countryOrRegion !== undefined && {
                    countryOrRegion: providerEvent.location.address.countryOrRegion,
                  }),
                ...(providerEvent.location.address.postalCode !== null &&
                  providerEvent.location.address.postalCode !== undefined && {
                    postalCode: providerEvent.location.address.postalCode,
                  }),
              },
            }),
          },
        }),
        ...(providerEvent.createdDateTime && { createdDateTime: providerEvent.createdDateTime }),
        ...(providerEvent.lastModifiedDateTime && { lastModifiedDateTime: providerEvent.lastModifiedDateTime }),
        ...(providerEvent.webLink && { webLink: providerEvent.webLink }),
      };
    },
  });
}
