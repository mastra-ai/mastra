// AUTO-GENERATED from NangoHQ/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyToolFilter } from '../../toolset.js';
import { addReactionTool } from './tools/add-reaction.js';
import { archiveChannelTool } from './tools/archive-channel.js';
import { createChannelTool } from './tools/create-channel.js';
import { createReminderTool } from './tools/create-reminder.js';
import { deleteMessageTool } from './tools/delete-message.js';
import { deleteScheduledMessageTool } from './tools/delete-scheduled-message.js';
import { getChannelInfoTool } from './tools/get-channel-info.js';
import { getChannelMembersTool } from './tools/get-channel-members.js';
import { getConversationHistoryTool } from './tools/get-conversation-history.js';
import { getDndInfoTool } from './tools/get-dnd-info.js';
import { getMessagePermalinkTool } from './tools/get-message-permalink.js';
import { getReactionsTool } from './tools/get-reactions.js';
import { getTeamInfoTool } from './tools/get-team-info.js';
import { getThreadRepliesTool } from './tools/get-thread-replies.js';
import { getUploadUrlTool } from './tools/get-upload-url.js';
import { getUserInfoTool } from './tools/get-user-info.js';
import { getUserPresenceTool } from './tools/get-user-presence.js';
import { getUserProfileTool } from './tools/get-user-profile.js';
import { inviteSharedTool } from './tools/invite-shared.js';
import { inviteToChannelTool } from './tools/invite-to-channel.js';
import { joinChannelTool } from './tools/join-channel.js';
import { leaveChannelTool } from './tools/leave-channel.js';
import { listChannelsTool } from './tools/list-channels.js';
import { listCustomEmojiTool } from './tools/list-custom-emoji.js';
import { listFilesTool } from './tools/list-files.js';
import { listPinsTool } from './tools/list-pins.js';
import { listScheduledMessagesTool } from './tools/list-scheduled-messages.js';
import { listUserGroupMembersTool } from './tools/list-user-group-members.js';
import { listUserGroupsTool } from './tools/list-user-groups.js';
import { listUserReactionsTool } from './tools/list-user-reactions.js';
import { listUsersTool } from './tools/list-users.js';
import { lookupUserByEmailTool } from './tools/lookup-user-by-email.js';
import { markAsReadTool } from './tools/mark-as-read.js';
import { openDmTool } from './tools/open-dm.js';
import { pinMessageTool } from './tools/pin-message.js';
import { postMessageTool } from './tools/post-message.js';
import { removeFromChannelTool } from './tools/remove-from-channel.js';
import { removeReactionTool } from './tools/remove-reaction.js';
import { renameChannelTool } from './tools/rename-channel.js';
import { scheduleMessageTool } from './tools/schedule-message.js';
import { searchFilesTool } from './tools/search-files.js';
import { searchMessagesTool } from './tools/search-messages.js';
import { sendEphemeralMessageTool } from './tools/send-ephemeral-message.js';
import { sendMessageTool } from './tools/send-message.js';
import { setChannelPurposeTool } from './tools/set-channel-purpose.js';
import { setChannelTopicTool } from './tools/set-channel-topic.js';
import { setStatusTool } from './tools/set-status.js';
import { setUserPresenceTool } from './tools/set-user-presence.js';
import { unarchiveChannelTool } from './tools/unarchive-channel.js';
import { unpinMessageTool } from './tools/unpin-message.js';
import { updateMessageTool } from './tools/update-message.js';

export function createSlackTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    slack_add_reaction: addReactionTool(platformProxy),
    slack_archive_channel: archiveChannelTool(platformProxy),
    slack_create_channel: createChannelTool(platformProxy),
    slack_create_reminder: createReminderTool(platformProxy),
    slack_delete_message: deleteMessageTool(platformProxy),
    slack_delete_scheduled_message: deleteScheduledMessageTool(platformProxy),
    slack_get_channel_info: getChannelInfoTool(platformProxy),
    slack_get_channel_members: getChannelMembersTool(platformProxy),
    slack_get_conversation_history: getConversationHistoryTool(platformProxy),
    slack_get_dnd_info: getDndInfoTool(platformProxy),
    slack_get_message_permalink: getMessagePermalinkTool(platformProxy),
    slack_get_reactions: getReactionsTool(platformProxy),
    slack_get_team_info: getTeamInfoTool(platformProxy),
    slack_get_thread_replies: getThreadRepliesTool(platformProxy),
    slack_get_upload_url: getUploadUrlTool(platformProxy),
    slack_get_user_info: getUserInfoTool(platformProxy),
    slack_get_user_presence: getUserPresenceTool(platformProxy),
    slack_get_user_profile: getUserProfileTool(platformProxy),
    slack_invite_shared: inviteSharedTool(platformProxy),
    slack_invite_to_channel: inviteToChannelTool(platformProxy),
    slack_join_channel: joinChannelTool(platformProxy),
    slack_leave_channel: leaveChannelTool(platformProxy),
    slack_list_channels: listChannelsTool(platformProxy),
    slack_list_custom_emoji: listCustomEmojiTool(platformProxy),
    slack_list_files: listFilesTool(platformProxy),
    slack_list_pins: listPinsTool(platformProxy),
    slack_list_scheduled_messages: listScheduledMessagesTool(platformProxy),
    slack_list_user_group_members: listUserGroupMembersTool(platformProxy),
    slack_list_user_groups: listUserGroupsTool(platformProxy),
    slack_list_user_reactions: listUserReactionsTool(platformProxy),
    slack_list_users: listUsersTool(platformProxy),
    slack_lookup_user_by_email: lookupUserByEmailTool(platformProxy),
    slack_mark_as_read: markAsReadTool(platformProxy),
    slack_open_dm: openDmTool(platformProxy),
    slack_pin_message: pinMessageTool(platformProxy),
    slack_post_message: postMessageTool(platformProxy),
    slack_remove_from_channel: removeFromChannelTool(platformProxy),
    slack_remove_reaction: removeReactionTool(platformProxy),
    slack_rename_channel: renameChannelTool(platformProxy),
    slack_schedule_message: scheduleMessageTool(platformProxy),
    slack_search_files: searchFilesTool(platformProxy),
    slack_search_messages: searchMessagesTool(platformProxy),
    slack_send_ephemeral_message: sendEphemeralMessageTool(platformProxy),
    slack_send_message: sendMessageTool(platformProxy),
    slack_set_channel_purpose: setChannelPurposeTool(platformProxy),
    slack_set_channel_topic: setChannelTopicTool(platformProxy),
    slack_set_status: setStatusTool(platformProxy),
    slack_set_user_presence: setUserPresenceTool(platformProxy),
    slack_unarchive_channel: unarchiveChannelTool(platformProxy),
    slack_unpin_message: unpinMessageTool(platformProxy),
    slack_update_message: updateMessageTool(platformProxy),
  };
  return applyToolFilter(tools, { allowTools: options?.allowTools, disallowTools: options?.disallowTools });
}
