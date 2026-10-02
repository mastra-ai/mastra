import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch } from '../scenario.js';

/**
 * Deep Google Calendar scenario: calendar + event + attendee + ACL lifecycle.
 * The scenario creates an ephemeral calendar so events don't contaminate the
 * user's primary one, then deletes it to clean up.
 */
export const googleCalendarScenario: Scenario = {
  integrationId: 'google-calendar',
  summary: 'calendar + event + attendee + ACL CRUD',
  async run({ tools, runId, call, log }) {
    const steps: ScenarioStep[] = [];
    const missing = requireTools(tools, [
      'google_calendar_create_calendar',
      'google_calendar_create_event',
      'google_calendar_delete_calendar',
    ]);
    if (missing) {
      steps.push({ name: 'preflight', status: 'skip', detail: missing });
      return steps;
    }

    steps.push(
      ...(await runReadBatch(
        call,
        [
          ['google_calendar_whoami', {}],
          ['google_calendar_list_calendar_list', { maxResults: 5 }],
          ['google_calendar_get_colors', {}],
          ['google_calendar_list_settings', {}],
        ],
        tools,
      )),
    );

    let calendarId: string | undefined;
    try {
      const cal = await call<{ id: string }>('google_calendar_create_calendar', {
        summary: `${runId} smoke calendar`,
        description: 'Automated @mastra/connect smoke test. Safe to delete.',
        timeZone: 'UTC',
      });
      calendarId = cal.id;
      steps.push(makeStep('create calendar', 'google_calendar_create_calendar', 'pass', calendarId));
    } catch (error) {
      steps.push(makeStep('create calendar', 'google_calendar_create_calendar', 'fail', errorMessage(error)));
      return steps;
    }

    let eventId: string | undefined;
    try {
      const now = Date.now();
      const start = new Date(now + 60 * 60 * 1000).toISOString();
      const end = new Date(now + 2 * 60 * 60 * 1000).toISOString();
      const event = await call<{ id: string }>('google_calendar_create_event', {
        calendarId,
        summary: `${runId} smoke event`,
        start: { dateTime: start, timeZone: 'UTC' },
        end: { dateTime: end, timeZone: 'UTC' },
        description: 'smoke test',
      });
      eventId = event.id;
      steps.push(makeStep('create event', 'google_calendar_create_event', 'pass', eventId));
    } catch (error) {
      steps.push(makeStep('create event', 'google_calendar_create_event', 'fail', errorMessage(error)));
    }

    if (eventId && tools['google_calendar_get_event']) {
      try {
        await call('google_calendar_get_event', { calendarId, eventId });
        steps.push(makeStep('read event', 'google_calendar_get_event', 'pass'));
      } catch (error) {
        steps.push(makeStep('read event', 'google_calendar_get_event', 'fail', errorMessage(error)));
      }
    }

    if (eventId && tools['google_calendar_update_event']) {
      try {
        await call('google_calendar_update_event', {
          calendarId,
          eventId,
          summary: `${runId} smoke event (renamed)`,
        });
        steps.push(makeStep('update event', 'google_calendar_update_event', 'pass'));
      } catch (error) {
        steps.push(makeStep('update event', 'google_calendar_update_event', 'fail', errorMessage(error)));
      }
    }

    if (eventId && tools['google_calendar_add_attendee']) {
      try {
        await call('google_calendar_add_attendee', {
          calendarId,
          eventId,
          email: `smoke+${runId}@mastra-smoke.invalid`,
        });
        steps.push(makeStep('add attendee', 'google_calendar_add_attendee', 'pass'));
      } catch (error) {
        steps.push(makeStep('add attendee', 'google_calendar_add_attendee', 'fail', errorMessage(error)));
      }
      if (tools['google_calendar_remove_attendee']) {
        try {
          await call('google_calendar_remove_attendee', {
            calendarId,
            eventId,
            email: `smoke+${runId}@mastra-smoke.invalid`,
          });
          steps.push(makeStep('remove attendee', 'google_calendar_remove_attendee', 'pass'));
        } catch (error) {
          steps.push(makeStep('remove attendee', 'google_calendar_remove_attendee', 'fail', errorMessage(error)));
        }
      }
    }

    if (tools['google_calendar_list_events']) {
      try {
        await call('google_calendar_list_events', { calendarId, maxResults: 5 });
        steps.push(makeStep('list events', 'google_calendar_list_events', 'pass'));
      } catch (error) {
        steps.push(makeStep('list events', 'google_calendar_list_events', 'fail', errorMessage(error)));
      }
    }

    if (tools['google_calendar_query_free_busy']) {
      try {
        const now = Date.now();
        await call('google_calendar_query_free_busy', {
          timeMin: new Date(now).toISOString(),
          timeMax: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
          items: [{ id: calendarId }],
        });
        steps.push(makeStep('query free/busy', 'google_calendar_query_free_busy', 'pass'));
      } catch (error) {
        steps.push(makeStep('query free/busy', 'google_calendar_query_free_busy', 'fail', errorMessage(error)));
      }
    }

    if (eventId && tools['google_calendar_delete_event']) {
      try {
        await call('google_calendar_delete_event', { calendarId, eventId });
        steps.push(makeStep('delete event', 'google_calendar_delete_event', 'pass'));
      } catch (error) {
        steps.push(makeStep('delete event', 'google_calendar_delete_event', 'fail', errorMessage(error)));
      }
    }

    try {
      await call('google_calendar_delete_calendar', { calendarId });
      steps.push(makeStep('delete calendar', 'google_calendar_delete_calendar', 'pass'));
    } catch (error) {
      log.error(`Failed to delete smoke calendar ${calendarId} — clean up manually.`, errorMessage(error));
      steps.push(makeStep('delete calendar', 'google_calendar_delete_calendar', 'fail', errorMessage(error)));
    }

    return steps;
  },
};
