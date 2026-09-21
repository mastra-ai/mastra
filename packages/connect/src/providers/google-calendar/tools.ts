// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyAllowTools } from '../../toolset.js';
import { addAttendeeTool } from './tools/add-attendee.js';
import { clearCalendarTool } from './tools/clear-calendar.js';
import { createAclRuleTool } from './tools/create-acl-rule.js';
import { createAllDayEventTool } from './tools/create-all-day-event.js';
import { createCalendarTool } from './tools/create-calendar.js';
import { createEventTool } from './tools/create-event.js';
import { createRecurringEventTool } from './tools/create-recurring-event.js';
import { deleteAclRuleTool } from './tools/delete-acl-rule.js';
import { deleteCalendarTool } from './tools/delete-calendar.js';
import { deleteEventTool } from './tools/delete-event.js';
import { findFreeSlotsTool } from './tools/find-free-slots.js';
import { getAclRuleTool } from './tools/get-acl-rule.js';
import { getCalendarListEntryTool } from './tools/get-calendar-list-entry.js';
import { getCalendarTool } from './tools/get-calendar.js';
import { getColorsTool } from './tools/get-colors.js';
import { getEventTool } from './tools/get-event.js';
import { getSettingTool } from './tools/get-setting.js';
import { insertCalendarToListTool } from './tools/insert-calendar-to-list.js';
import { listAclRulesTool } from './tools/list-acl-rules.js';
import { listCalendarListTool } from './tools/list-calendar-list.js';
import { listEventInstancesTool } from './tools/list-event-instances.js';
import { listEventsTool } from './tools/list-events.js';
import { listSettingsTool } from './tools/list-settings.js';
import { listUpcomingEventsTool } from './tools/list-upcoming-events.js';
import { moveEventTool } from './tools/move-event.js';
import { patchEventTool } from './tools/patch-event.js';
import { queryFreeBusyTool } from './tools/query-free-busy.js';
import { quickAddEventTool } from './tools/quick-add-event.js';
import { removeAttendeeTool } from './tools/remove-attendee.js';
import { removeCalendarFromListTool } from './tools/remove-calendar-from-list.js';
import { searchEventsTool } from './tools/search-events.js';
import { settingsTool } from './tools/settings.js';
import { stopChannelTool } from './tools/stop-channel.js';
import { updateAclRuleTool } from './tools/update-acl-rule.js';
import { updateAttendeeResponseTool } from './tools/update-attendee-response.js';
import { updateCalendarListEntryTool } from './tools/update-calendar-list-entry.js';
import { updateCalendarTool } from './tools/update-calendar.js';
import { updateEventTool } from './tools/update-event.js';
import { watchCalendarListTool } from './tools/watch-calendar-list.js';
import { watchEventsTool } from './tools/watch-events.js';
import { watchSettingsTool } from './tools/watch-settings.js';
import { whoamiTool } from './tools/whoami.js';

export function createGoogleCalendarTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    google_calendar_add_attendee: addAttendeeTool(platformProxy),
    google_calendar_clear_calendar: clearCalendarTool(platformProxy),
    google_calendar_create_acl_rule: createAclRuleTool(platformProxy),
    google_calendar_create_all_day_event: createAllDayEventTool(platformProxy),
    google_calendar_create_calendar: createCalendarTool(platformProxy),
    google_calendar_create_event: createEventTool(platformProxy),
    google_calendar_create_recurring_event: createRecurringEventTool(platformProxy),
    google_calendar_delete_acl_rule: deleteAclRuleTool(platformProxy),
    google_calendar_delete_calendar: deleteCalendarTool(platformProxy),
    google_calendar_delete_event: deleteEventTool(platformProxy),
    google_calendar_find_free_slots: findFreeSlotsTool(platformProxy),
    google_calendar_get_acl_rule: getAclRuleTool(platformProxy),
    google_calendar_get_calendar_list_entry: getCalendarListEntryTool(platformProxy),
    google_calendar_get_calendar: getCalendarTool(platformProxy),
    google_calendar_get_colors: getColorsTool(platformProxy),
    google_calendar_get_event: getEventTool(platformProxy),
    google_calendar_get_setting: getSettingTool(platformProxy),
    google_calendar_insert_calendar_to_list: insertCalendarToListTool(platformProxy),
    google_calendar_list_acl_rules: listAclRulesTool(platformProxy),
    google_calendar_list_calendar_list: listCalendarListTool(platformProxy),
    google_calendar_list_event_instances: listEventInstancesTool(platformProxy),
    google_calendar_list_events: listEventsTool(platformProxy),
    google_calendar_list_settings: listSettingsTool(platformProxy),
    google_calendar_list_upcoming_events: listUpcomingEventsTool(platformProxy),
    google_calendar_move_event: moveEventTool(platformProxy),
    google_calendar_patch_event: patchEventTool(platformProxy),
    google_calendar_query_free_busy: queryFreeBusyTool(platformProxy),
    google_calendar_quick_add_event: quickAddEventTool(platformProxy),
    google_calendar_remove_attendee: removeAttendeeTool(platformProxy),
    google_calendar_remove_calendar_from_list: removeCalendarFromListTool(platformProxy),
    google_calendar_search_events: searchEventsTool(platformProxy),
    google_calendar_settings: settingsTool(platformProxy),
    google_calendar_stop_channel: stopChannelTool(platformProxy),
    google_calendar_update_acl_rule: updateAclRuleTool(platformProxy),
    google_calendar_update_attendee_response: updateAttendeeResponseTool(platformProxy),
    google_calendar_update_calendar_list_entry: updateCalendarListEntryTool(platformProxy),
    google_calendar_update_calendar: updateCalendarTool(platformProxy),
    google_calendar_update_event: updateEventTool(platformProxy),
    google_calendar_watch_calendar_list: watchCalendarListTool(platformProxy),
    google_calendar_watch_events: watchEventsTool(platformProxy),
    google_calendar_watch_settings: watchSettingsTool(platformProxy),
    google_calendar_whoami: whoamiTool(platformProxy),
  };
  return applyAllowTools(tools, options?.allowTools);
}
