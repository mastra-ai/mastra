// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyToolFilter } from '../../toolset.js';
import { addEventAttachmentTool } from './tools/add-event-attachment.js';
import { addMessageAttachmentTool } from './tools/add-message-attachment.js';
import { cancelEventTool } from './tools/cancel-event.js';
import { copyMessageTool } from './tools/copy-message.js';
import { createCalendarTool } from './tools/create-calendar.js';
import { createDraftMessageTool } from './tools/create-draft-message.js';
import { createEventTool } from './tools/create-event.js';
import { createMailFolderTool } from './tools/create-mail-folder.js';
import { deleteCalendarTool } from './tools/delete-calendar.js';
import { deleteEventTool } from './tools/delete-event.js';
import { deleteMessageTool } from './tools/delete-message.js';
import { downloadMessageAttachmentTool } from './tools/download-message-attachment.js';
import { getCalendarTool } from './tools/get-calendar.js';
import { getEventTool } from './tools/get-event.js';
import { getMessageTool } from './tools/get-message.js';
import { listCalendarEventsTool } from './tools/list-calendar-events.js';
import { listCalendarsTool } from './tools/list-calendars.js';
import { listEventAttachmentsTool } from './tools/list-event-attachments.js';
import { listMailFolderChildrenTool } from './tools/list-mail-folder-children.js';
import { listMailFoldersTool } from './tools/list-mail-folders.js';
import { listMessageAttachmentsTool } from './tools/list-message-attachments.js';
import { listMessagesTool } from './tools/list-messages.js';
import { moveMessageTool } from './tools/move-message.js';
import { replyAllToMessageTool } from './tools/reply-all-to-message.js';
import { replyToMessageTool } from './tools/reply-to-message.js';
import { sendDraftMessageTool } from './tools/send-draft-message.js';
import { sendMailTool } from './tools/send-mail.js';
import { updateCalendarTool } from './tools/update-calendar.js';
import { updateEventTool } from './tools/update-event.js';
import { updateMessageTool } from './tools/update-message.js';

export function createOutlookTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    outlook_add_event_attachment: addEventAttachmentTool(platformProxy),
    outlook_add_message_attachment: addMessageAttachmentTool(platformProxy),
    outlook_cancel_event: cancelEventTool(platformProxy),
    outlook_copy_message: copyMessageTool(platformProxy),
    outlook_create_calendar: createCalendarTool(platformProxy),
    outlook_create_draft_message: createDraftMessageTool(platformProxy),
    outlook_create_event: createEventTool(platformProxy),
    outlook_create_mail_folder: createMailFolderTool(platformProxy),
    outlook_delete_calendar: deleteCalendarTool(platformProxy),
    outlook_delete_event: deleteEventTool(platformProxy),
    outlook_delete_message: deleteMessageTool(platformProxy),
    outlook_download_message_attachment: downloadMessageAttachmentTool(platformProxy),
    outlook_get_calendar: getCalendarTool(platformProxy),
    outlook_get_event: getEventTool(platformProxy),
    outlook_get_message: getMessageTool(platformProxy),
    outlook_list_calendar_events: listCalendarEventsTool(platformProxy),
    outlook_list_calendars: listCalendarsTool(platformProxy),
    outlook_list_event_attachments: listEventAttachmentsTool(platformProxy),
    outlook_list_mail_folder_children: listMailFolderChildrenTool(platformProxy),
    outlook_list_mail_folders: listMailFoldersTool(platformProxy),
    outlook_list_message_attachments: listMessageAttachmentsTool(platformProxy),
    outlook_list_messages: listMessagesTool(platformProxy),
    outlook_move_message: moveMessageTool(platformProxy),
    outlook_reply_all_to_message: replyAllToMessageTool(platformProxy),
    outlook_reply_to_message: replyToMessageTool(platformProxy),
    outlook_send_draft_message: sendDraftMessageTool(platformProxy),
    outlook_send_mail: sendMailTool(platformProxy),
    outlook_update_calendar: updateCalendarTool(platformProxy),
    outlook_update_event: updateEventTool(platformProxy),
    outlook_update_message: updateMessageTool(platformProxy),
  };
  return applyToolFilter(tools, { allowTools: options?.allowTools, disallowTools: options?.disallowTools });
}
