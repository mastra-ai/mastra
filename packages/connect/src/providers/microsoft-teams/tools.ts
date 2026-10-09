// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyAllowTools } from '../../toolset.js';
import { addTeamMemberTool } from './tools/add-team-member.js';
import { createChannelMessageTool } from './tools/create-channel-message.js';
import { createChannelTabTool } from './tools/create-channel-tab.js';
import { createChannelTool } from './tools/create-channel.js';
import { createChatMessageTool } from './tools/create-chat-message.js';
import { createChatTool } from './tools/create-chat.js';
import { createTeamTool } from './tools/create-team.js';
import { deleteChannelTool } from './tools/delete-channel.js';
import { getChannelMessageTool } from './tools/get-channel-message.js';
import { getChannelTool } from './tools/get-channel.js';
import { getChatMessageTool } from './tools/get-chat-message.js';
import { getChatTool } from './tools/get-chat.js';
import { getTeamTool } from './tools/get-team.js';
import { listChannelMessagesTool } from './tools/list-channel-messages.js';
import { listChannelRepliesTool } from './tools/list-channel-replies.js';
import { listChannelTabsTool } from './tools/list-channel-tabs.js';
import { listChannelsTool } from './tools/list-channels.js';
import { listChatMembersTool } from './tools/list-chat-members.js';
import { listChatMessagesTool } from './tools/list-chat-messages.js';
import { listChatsTool } from './tools/list-chats.js';
import { listJoinedTeamsTool } from './tools/list-joined-teams.js';
import { listTeamMembersTool } from './tools/list-team-members.js';
import { removeTeamMemberTool } from './tools/remove-team-member.js';
import { replyToChannelMessageTool } from './tools/reply-to-channel-message.js';
import { updateChannelTool } from './tools/update-channel.js';

export function createMicrosoftTeamsTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    microsoft_teams_add_team_member: addTeamMemberTool(platformProxy),
    microsoft_teams_create_channel_message: createChannelMessageTool(platformProxy),
    microsoft_teams_create_channel_tab: createChannelTabTool(platformProxy),
    microsoft_teams_create_channel: createChannelTool(platformProxy),
    microsoft_teams_create_chat_message: createChatMessageTool(platformProxy),
    microsoft_teams_create_chat: createChatTool(platformProxy),
    microsoft_teams_create_team: createTeamTool(platformProxy),
    microsoft_teams_delete_channel: deleteChannelTool(platformProxy),
    microsoft_teams_get_channel_message: getChannelMessageTool(platformProxy),
    microsoft_teams_get_channel: getChannelTool(platformProxy),
    microsoft_teams_get_chat_message: getChatMessageTool(platformProxy),
    microsoft_teams_get_chat: getChatTool(platformProxy),
    microsoft_teams_get_team: getTeamTool(platformProxy),
    microsoft_teams_list_channel_messages: listChannelMessagesTool(platformProxy),
    microsoft_teams_list_channel_replies: listChannelRepliesTool(platformProxy),
    microsoft_teams_list_channel_tabs: listChannelTabsTool(platformProxy),
    microsoft_teams_list_channels: listChannelsTool(platformProxy),
    microsoft_teams_list_chat_members: listChatMembersTool(platformProxy),
    microsoft_teams_list_chat_messages: listChatMessagesTool(platformProxy),
    microsoft_teams_list_chats: listChatsTool(platformProxy),
    microsoft_teams_list_joined_teams: listJoinedTeamsTool(platformProxy),
    microsoft_teams_list_team_members: listTeamMembersTool(platformProxy),
    microsoft_teams_remove_team_member: removeTeamMemberTool(platformProxy),
    microsoft_teams_reply_to_channel_message: replyToChannelMessageTool(platformProxy),
    microsoft_teams_update_channel: updateChannelTool(platformProxy),
  };
  return applyAllowTools(tools, options?.allowTools);
}
