// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { PlatformProxy } from '../../../runtime/platform-proxy.js';

const TimeMinSchema = z.string().describe('Start of the time range in RFC3339 format. Example: "2024-03-15T09:00:00Z"');

const TimeMaxSchema = z.string().describe('End of the time range in RFC3339 format. Example: "2024-03-15T17:00:00Z"');

export const findFreeSlotsInputSchema = z
  .object({
    calendarIds: z
      .array(z.string())
      .min(1)
      .describe('List of calendar IDs to check for free/busy information. Example: ["primary", "work@example.com"]'),
    timeMin: TimeMinSchema,
    timeMax: TimeMaxSchema,
    timeZone: z
      .string()
      .optional()
      .describe('Time zone used in the response. Defaults to UTC if omitted. Example: "America/New_York"'),
    durationMinutes: z
      .number()
      .min(1)
      .describe('Minimum duration in minutes for a free slot to be returned. Example: 30'),
  })
  .describe('Input for finding free time slots across calendars.');

const FreeSlotSchema = z.object({
  start: z.string().describe('Start time of the free slot in RFC3339 format'),
  end: z.string().describe('End time of the free slot in RFC3339 format'),
  durationMinutes: z.number().describe('Duration of the free slot in minutes'),
});

export const findFreeSlotsOutputSchema = z.object({
  freeSlots: z.array(FreeSlotSchema).describe('List of free time slots meeting the minimum duration'),
  calendarsChecked: z.number().describe('Number of calendars checked'),
});

const BusyIntervalSchema = z.object({
  start: z.string(),
  end: z.string(),
});

const CalendarErrorSchema = z.object({
  domain: z.string(),
  reason: z.string(),
});

const CalendarFreeBusySchema = z.object({
  busy: z.array(BusyIntervalSchema).default([]),
  errors: z.array(CalendarErrorSchema).optional(),
});

const GroupFreeBusySchema = z.object({
  calendars: z.array(z.string()).optional(),
  errors: z.array(CalendarErrorSchema).optional(),
});

const FreeBusyResponseSchema = z.object({
  timeMin: z.string(),
  timeMax: z.string(),
  calendars: z.record(z.string(), CalendarFreeBusySchema).optional(),
  groups: z.record(z.string(), GroupFreeBusySchema).optional(),
});

export function findFreeSlotsTool(proxy: PlatformProxy) {
  return createTool({
    id: 'google_calendar_find_free_slots',
    description: 'Query free/busy data and return gaps meeting a minimum duration.',
    inputSchema: findFreeSlotsInputSchema,
    outputSchema: findFreeSlotsOutputSchema,
    execute: async (input, { requestContext }): Promise<z.infer<typeof findFreeSlotsOutputSchema>> => {
      const platformProxy = proxy.withRequestContext(requestContext);
      // https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query
      const response = await platformProxy.post({
        endpoint: '/calendar/v3/freeBusy',
        data: {
          timeMin: input.timeMin,
          timeMax: input.timeMax,
          items: input.calendarIds.map(id => ({ id })),
          ...(input.timeZone !== undefined && { timeZone: input.timeZone }),
        },
        retries: 3,
      });

      const freeBusy = FreeBusyResponseSchema.parse(response.data);
      const calendars = freeBusy.calendars ?? {};
      const groups = freeBusy.groups ?? {};

      // Propagate group-expansion errors instead of silently dropping them.
      for (const [groupId, group] of Object.entries(groups)) {
        if (group.errors && group.errors.length > 0) {
          const reasons = group.errors.map(error => error.reason);
          throw new platformProxy.ActionError({
            type: 'calendar_error',
            message: `Group "${groupId}" returned errors: ${reasons.join(', ')}`,
          });
        }
      }

      // A requested calendar/group that is entirely absent from the response would
      // otherwise be silently treated as fully free; fail instead of guessing.
      for (const id of input.calendarIds) {
        if (!(id in calendars) && !(id in groups)) {
          throw new platformProxy.ActionError({
            type: 'calendar_error',
            message: `No free/busy data returned for "${id}"`,
          });
        }
      }

      const allBusyPeriods: Array<{ start: string; end: string }> = [];

      for (const [calendarId, calendarData] of Object.entries(calendars)) {
        if (calendarData.errors && calendarData.errors.length > 0) {
          const reasons = calendarData.errors.map(error => error.reason);
          throw new platformProxy.ActionError({
            type: 'calendar_error',
            message: `Calendar "${calendarId}" returned errors: ${reasons.join(', ')}`,
          });
        }

        for (const period of calendarData.busy) {
          allBusyPeriods.push({ start: period.start, end: period.end });
        }
      }

      const calendarCount = Object.keys(calendars).length;

      // Sort busy periods by start time
      allBusyPeriods.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

      // Merge overlapping busy periods
      const mergedBusyPeriods: Array<{ start: string; end: string }> = [];

      for (const period of allBusyPeriods) {
        if (mergedBusyPeriods.length === 0) {
          mergedBusyPeriods.push(period);
          continue;
        }

        const lastPeriod = mergedBusyPeriods[mergedBusyPeriods.length - 1];
        if (!lastPeriod) {
          mergedBusyPeriods.push(period);
          continue;
        }

        const lastEnd = new Date(lastPeriod.end).getTime();
        const currentStart = new Date(period.start).getTime();

        if (currentStart <= lastEnd) {
          // Overlapping or contiguous - merge them
          const currentEnd = new Date(period.end).getTime();
          if (currentEnd > lastEnd) {
            lastPeriod.end = period.end;
          }
        } else {
          // No overlap - add new period
          mergedBusyPeriods.push(period);
        }
      }

      // Find free slots (gaps between busy periods)
      const freeSlots: Array<{ start: string; end: string; durationMinutes: number }> = [];
      const rangeStart = new Date(input.timeMin).getTime();
      const rangeEnd = new Date(input.timeMax).getTime();
      const minDurationMs = input.durationMinutes * 60 * 1000;

      if (mergedBusyPeriods.length === 0) {
        // No busy periods at all - entire range is free
        const totalDuration = rangeEnd - rangeStart;
        if (totalDuration >= minDurationMs) {
          freeSlots.push({
            start: input.timeMin,
            end: input.timeMax,
            durationMinutes: Math.floor(totalDuration / (60 * 1000)),
          });
        }
      } else {
        // Check for free time before first busy period
        const firstBusyPeriod = mergedBusyPeriods[0];
        if (firstBusyPeriod) {
          const firstBusyStart = new Date(firstBusyPeriod.start).getTime();
          if (firstBusyStart > rangeStart) {
            const gapDuration = firstBusyStart - rangeStart;
            if (gapDuration >= minDurationMs) {
              freeSlots.push({
                start: input.timeMin,
                end: firstBusyPeriod.start,
                durationMinutes: Math.floor(gapDuration / (60 * 1000)),
              });
            }
          }
        }

        // Check gaps between busy periods
        for (let i = 0; i < mergedBusyPeriods.length - 1; i++) {
          const currentPeriod = mergedBusyPeriods[i];
          const nextPeriod = mergedBusyPeriods[i + 1];

          if (!currentPeriod || !nextPeriod) {
            continue;
          }

          const currentEnd = new Date(currentPeriod.end).getTime();
          const nextStart = new Date(nextPeriod.start).getTime();

          if (nextStart > currentEnd) {
            const gapDuration = nextStart - currentEnd;
            if (gapDuration >= minDurationMs) {
              freeSlots.push({
                start: currentPeriod.end,
                end: nextPeriod.start,
                durationMinutes: Math.floor(gapDuration / (60 * 1000)),
              });
            }
          }
        }

        // Check for free time after last busy period
        const lastBusyPeriod = mergedBusyPeriods[mergedBusyPeriods.length - 1];
        if (lastBusyPeriod) {
          const lastBusyEnd = new Date(lastBusyPeriod.end).getTime();
          if (lastBusyEnd < rangeEnd) {
            const gapDuration = rangeEnd - lastBusyEnd;
            if (gapDuration >= minDurationMs) {
              freeSlots.push({
                start: lastBusyPeriod.end,
                end: input.timeMax,
                durationMinutes: Math.floor(gapDuration / (60 * 1000)),
              });
            }
          }
        }
      }

      return {
        freeSlots,
        calendarsChecked: calendarCount,
      };
    },
  });
}
