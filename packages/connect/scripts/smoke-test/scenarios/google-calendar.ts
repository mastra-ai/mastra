import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch, probeTool } from '../scenario.js';

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
          ['google_calendar_settings', {}],
        ],
        tools,
      )),
    );

    if (tools['google_calendar_get_setting']) {
      steps.push(await probeTool(call, tools, 'get setting', 'google_calendar_get_setting', { settingId: 'timezone' }));
    }

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

    // Calendar read-only + list entry operations on the fresh calendar.
    if (tools['google_calendar_get_calendar']) {
      try {
        await call('google_calendar_get_calendar', { calendarId });
        steps.push(makeStep('get calendar', 'google_calendar_get_calendar', 'pass'));
      } catch (error) {
        steps.push(makeStep('get calendar', 'google_calendar_get_calendar', 'fail', errorMessage(error)));
      }
    }
    if (tools['google_calendar_update_calendar']) {
      try {
        await call('google_calendar_update_calendar', {
          calendarId,
          description: `${runId} smoke calendar (renamed)`,
        });
        steps.push(makeStep('update calendar', 'google_calendar_update_calendar', 'pass'));
      } catch (error) {
        steps.push(makeStep('update calendar', 'google_calendar_update_calendar', 'fail', errorMessage(error)));
      }
    }

    // Calendar-list operations: insert the created calendar into the list, update, remove.
    if (tools['google_calendar_insert_calendar_to_list']) {
      try {
        await call('google_calendar_insert_calendar_to_list', { calendarId, selected: true });
        steps.push(makeStep('insert calendar to list', 'google_calendar_insert_calendar_to_list', 'pass'));
      } catch (error) {
        steps.push(
          makeStep('insert calendar to list', 'google_calendar_insert_calendar_to_list', 'fail', errorMessage(error)),
        );
      }
    }
    if (tools['google_calendar_get_calendar_list_entry']) {
      try {
        await call('google_calendar_get_calendar_list_entry', { calendarId });
        steps.push(makeStep('get calendar list entry', 'google_calendar_get_calendar_list_entry', 'pass'));
      } catch (error) {
        steps.push(
          makeStep('get calendar list entry', 'google_calendar_get_calendar_list_entry', 'fail', errorMessage(error)),
        );
      }
    }
    if (tools['google_calendar_update_calendar_list_entry']) {
      try {
        await call('google_calendar_update_calendar_list_entry', { calendarId, hidden: true });
        steps.push(makeStep('update calendar list entry', 'google_calendar_update_calendar_list_entry', 'pass'));
      } catch (error) {
        steps.push(
          makeStep(
            'update calendar list entry',
            'google_calendar_update_calendar_list_entry',
            'fail',
            errorMessage(error),
          ),
        );
      }
    }

    // ACL CRUD on the fresh calendar.
    const aclScopeValue = `mastra-smoke+${runId}@example.com`;
    let aclRuleId: string | undefined;
    if (tools['google_calendar_create_acl_rule']) {
      try {
        const result = await call<{ id?: string }>('google_calendar_create_acl_rule', {
          calendarId,
          role: 'reader',
          scope: { type: 'user', value: aclScopeValue },
          sendNotifications: false,
        });
        aclRuleId = result.id;
        steps.push(makeStep('create acl rule', 'google_calendar_create_acl_rule', 'pass', aclRuleId));
      } catch (error) {
        steps.push(makeStep('create acl rule', 'google_calendar_create_acl_rule', 'fail', errorMessage(error)));
      }
    }
    if (tools['google_calendar_list_acl_rules']) {
      try {
        await call('google_calendar_list_acl_rules', { calendarId });
        steps.push(makeStep('list acl rules', 'google_calendar_list_acl_rules', 'pass'));
      } catch (error) {
        steps.push(makeStep('list acl rules', 'google_calendar_list_acl_rules', 'fail', errorMessage(error)));
      }
    }
    if (aclRuleId && tools['google_calendar_get_acl_rule']) {
      try {
        await call('google_calendar_get_acl_rule', { calendarId, ruleId: aclRuleId });
        steps.push(makeStep('get acl rule', 'google_calendar_get_acl_rule', 'pass'));
      } catch (error) {
        steps.push(makeStep('get acl rule', 'google_calendar_get_acl_rule', 'fail', errorMessage(error)));
      }
    }
    if (aclRuleId && tools['google_calendar_update_acl_rule']) {
      try {
        await call('google_calendar_update_acl_rule', {
          calendarId,
          ruleId: aclRuleId,
          role: 'writer',
          scope: { type: 'user', value: aclScopeValue },
          sendNotifications: false,
        });
        steps.push(makeStep('update acl rule', 'google_calendar_update_acl_rule', 'pass'));
      } catch (error) {
        steps.push(makeStep('update acl rule', 'google_calendar_update_acl_rule', 'fail', errorMessage(error)));
      }
    }
    if (aclRuleId && tools['google_calendar_delete_acl_rule']) {
      try {
        await call('google_calendar_delete_acl_rule', { calendarId, ruleId: aclRuleId });
        steps.push(makeStep('delete acl rule', 'google_calendar_delete_acl_rule', 'pass'));
      } catch (error) {
        steps.push(makeStep('delete acl rule', 'google_calendar_delete_acl_rule', 'fail', errorMessage(error)));
      }
    }

    // Event variants: all-day, recurring, quick-add, import.
    if (tools['google_calendar_create_all_day_event']) {
      try {
        const today = new Date().toISOString().slice(0, 10);
        await call('google_calendar_create_all_day_event', {
          calendarId,
          summary: `${runId} all-day`,
          startDate: today,
          endDate: today,
        });
        steps.push(makeStep('create all-day event', 'google_calendar_create_all_day_event', 'pass'));
      } catch (error) {
        steps.push(
          makeStep('create all-day event', 'google_calendar_create_all_day_event', 'fail', errorMessage(error)),
        );
      }
    }
    if (tools['google_calendar_create_recurring_event']) {
      try {
        const now = Date.now();
        await call('google_calendar_create_recurring_event', {
          calendarId,
          summary: `${runId} recurring`,
          start: new Date(now + 60 * 60 * 1000).toISOString(),
          end: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
          rrule: 'FREQ=WEEKLY;BYDAY=MO;COUNT=1',
          timezone: 'UTC',
        });
        steps.push(makeStep('create recurring event', 'google_calendar_create_recurring_event', 'pass'));
      } catch (error) {
        steps.push(
          makeStep('create recurring event', 'google_calendar_create_recurring_event', 'fail', errorMessage(error)),
        );
      }
    }
    if (tools['google_calendar_quick_add_event']) {
      try {
        await call('google_calendar_quick_add_event', {
          calendarId,
          text: `${runId} smoke quick add tomorrow 5pm`,
        });
        steps.push(makeStep('quick add event', 'google_calendar_quick_add_event', 'pass'));
      } catch (error) {
        steps.push(makeStep('quick add event', 'google_calendar_quick_add_event', 'fail', errorMessage(error)));
      }
    }
    if (tools['google_calendar_import_event']) {
      try {
        const now = Date.now();
        await call('google_calendar_import_event', {
          calendarId,
          event: {
            summary: `${runId} imported`,
            start: { dateTime: new Date(now + 3 * 60 * 60 * 1000).toISOString(), timeZone: 'UTC' },
            end: { dateTime: new Date(now + 4 * 60 * 60 * 1000).toISOString(), timeZone: 'UTC' },
            iCalUID: `smoke-${runId}@mastra`,
          },
        });
        steps.push(makeStep('import event', 'google_calendar_import_event', 'pass'));
      } catch (error) {
        steps.push(makeStep('import event', 'google_calendar_import_event', 'fail', errorMessage(error)));
      }
    }

    // Event discovery / instance operations.
    if (eventId && tools['google_calendar_patch_event']) {
      try {
        await call('google_calendar_patch_event', {
          calendarId,
          eventId,
          description: `${runId} patched`,
        });
        steps.push(makeStep('patch event', 'google_calendar_patch_event', 'pass'));
      } catch (error) {
        steps.push(makeStep('patch event', 'google_calendar_patch_event', 'fail', errorMessage(error)));
      }
    }
    if (eventId && tools['google_calendar_update_attendee_response']) {
      try {
        await call('google_calendar_update_attendee_response', {
          calendarId,
          eventId,
          attendeeEmail: aclScopeValue,
          responseStatus: 'accepted',
        });
        steps.push(makeStep('update attendee response', 'google_calendar_update_attendee_response', 'pass'));
      } catch (error) {
        steps.push(
          makeStep('update attendee response', 'google_calendar_update_attendee_response', 'fail', errorMessage(error)),
        );
      }
    }
    if (eventId && tools['google_calendar_list_event_instances']) {
      try {
        await call('google_calendar_list_event_instances', { calendarId, eventId });
        steps.push(makeStep('list event instances', 'google_calendar_list_event_instances', 'pass'));
      } catch (error) {
        steps.push(
          makeStep('list event instances', 'google_calendar_list_event_instances', 'fail', errorMessage(error)),
        );
      }
    }
    if (tools['google_calendar_list_upcoming_events']) {
      try {
        await call('google_calendar_list_upcoming_events', { calendarId, maxResults: 5 });
        steps.push(makeStep('list upcoming events', 'google_calendar_list_upcoming_events', 'pass'));
      } catch (error) {
        steps.push(
          makeStep('list upcoming events', 'google_calendar_list_upcoming_events', 'fail', errorMessage(error)),
        );
      }
    }
    if (tools['google_calendar_search_events']) {
      try {
        await call('google_calendar_search_events', { calendarId, query: runId });
        steps.push(makeStep('search events', 'google_calendar_search_events', 'pass'));
      } catch (error) {
        steps.push(makeStep('search events', 'google_calendar_search_events', 'fail', errorMessage(error)));
      }
    }
    if (tools['google_calendar_find_free_slots']) {
      try {
        const now = Date.now();
        await call('google_calendar_find_free_slots', {
          calendarIds: [calendarId!],
          timeMin: new Date(now).toISOString(),
          timeMax: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
          durationMinutes: 30,
          timeZone: 'UTC',
        });
        steps.push(makeStep('find free slots', 'google_calendar_find_free_slots', 'pass'));
      } catch (error) {
        steps.push(makeStep('find free slots', 'google_calendar_find_free_slots', 'fail', errorMessage(error)));
      }
    }
    if (eventId && tools['google_calendar_move_event']) {
      // Move to primary (and back) to exercise the endpoint without leaving
      // the event on the user's primary calendar.
      try {
        await call('google_calendar_move_event', {
          calendarId,
          eventId,
          destinationCalendarId: 'primary',
          sendUpdates: 'none',
        });
        steps.push(makeStep('move event -> primary', 'google_calendar_move_event', 'pass'));
        try {
          await call('google_calendar_move_event', {
            calendarId: 'primary',
            eventId,
            destinationCalendarId: calendarId!,
            sendUpdates: 'none',
          });
          steps.push(makeStep('move event -> back', 'google_calendar_move_event', 'pass'));
        } catch (restoreErr) {
          log.error(`Failed to move event ${eventId} back to smoke calendar — cleanup leak`, errorMessage(restoreErr));
          steps.push(makeStep('move event -> back', 'google_calendar_move_event', 'fail', errorMessage(restoreErr)));
        }
      } catch (error) {
        steps.push(makeStep('move event -> primary', 'google_calendar_move_event', 'fail', errorMessage(error)));
      }
    }

    // Watch channel operations: Google requires a verifiable HTTPS webhook.
    // We invoke each with a dummy URL and treat the 400/401 reply as proof
    // of routing. stop_channel also probed with synthetic ids.
    const watchAddress = 'https://smoke.invalid/callback';
    if (tools['google_calendar_watch_events']) {
      steps.push(
        await probeTool(call, tools, 'watch events (probe)', 'google_calendar_watch_events', {
          calendarId,
          channelId: `smoke-events-${runId}`,
          address: watchAddress,
          type: 'web_hook',
        }),
      );
    }
    if (tools['google_calendar_watch_calendar_list']) {
      steps.push(
        await probeTool(call, tools, 'watch calendar list (probe)', 'google_calendar_watch_calendar_list', {
          id: `smoke-list-${runId}`,
          address: watchAddress,
        }),
      );
    }
    if (tools['google_calendar_watch_settings']) {
      steps.push(
        await probeTool(call, tools, 'watch settings (probe)', 'google_calendar_watch_settings', {
          id: `smoke-settings-${runId}`,
          address: watchAddress,
          type: 'web_hook',
        }),
      );
    }
    if (tools['google_calendar_stop_channel']) {
      steps.push(
        await probeTool(call, tools, 'stop channel (probe)', 'google_calendar_stop_channel', {
          id: `smoke-${runId}`,
          resourceId: 'smoke-resource-id',
        }),
      );
    }

    // Clear calendar: wipes all events. Only safe on the fresh ephemeral
    // calendar we just created — Google rejects clearCalendar on anything
    // other than the primary calendar, so the call almost certainly 403s
    // with a message proving we hit the endpoint. Keep it to exercise.
    if (tools['google_calendar_clear_calendar']) {
      steps.push(
        await probeTool(call, tools, 'clear calendar (probe)', 'google_calendar_clear_calendar', {
          calendarId: 'primary',
        }),
      );
    }

    if (tools['google_calendar_remove_calendar_from_list']) {
      try {
        await call('google_calendar_remove_calendar_from_list', { calendarId });
        steps.push(makeStep('remove calendar from list', 'google_calendar_remove_calendar_from_list', 'pass'));
      } catch (error) {
        steps.push(
          makeStep(
            'remove calendar from list',
            'google_calendar_remove_calendar_from_list',
            'fail',
            errorMessage(error),
          ),
        );
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
