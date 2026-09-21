// AUTO-GENERATED from arctic-char/integration-templates @ c3091db1e8a6 — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyAllowTools } from '../../toolset.js';
import { addGuildMemberRoleTool } from './tools/add-guild-member-role.js';
import { createChannelTool } from './tools/create-channel.js';
import { createMessageTool } from './tools/create-message.js';
import { createReactionTool } from './tools/create-reaction.js';
import { createRoleTool } from './tools/create-role.js';
import { createThreadFromMessageTool } from './tools/create-thread-from-message.js';
import { createWebhookTool } from './tools/create-webhook.js';
import { deleteChannelTool } from './tools/delete-channel.js';
import { deleteGuildMemberTool } from './tools/delete-guild-member.js';
import { deleteGuildTool } from './tools/delete-guild.js';
import { deleteMessageTool } from './tools/delete-message.js';
import { deleteReactionTool } from './tools/delete-reaction.js';
import { deleteRoleTool } from './tools/delete-role.js';
import { deleteWebhookTool } from './tools/delete-webhook.js';
import { getChannelTool } from './tools/get-channel.js';
import { getGuildMemberTool } from './tools/get-guild-member.js';
import { getGuildTool } from './tools/get-guild.js';
import { getMessageTool } from './tools/get-message.js';
import { getRoleTool } from './tools/get-role.js';
import { getWebhookTool } from './tools/get-webhook.js';
import { listChannelsTool } from './tools/list-channels.js';
import { listGuildMembersTool } from './tools/list-guild-members.js';
import { listGuildsTool } from './tools/list-guilds.js';
import { listMessagesTool } from './tools/list-messages.js';
import { listRolesTool } from './tools/list-roles.js';
import { listWebhooksTool } from './tools/list-webhooks.js';
import { removeGuildMemberRoleTool } from './tools/remove-guild-member-role.js';
import { updateChannelTool } from './tools/update-channel.js';
import { updateGuildMemberTool } from './tools/update-guild-member.js';
import { updateGuildTool } from './tools/update-guild.js';
import { updateMessageTool } from './tools/update-message.js';
import { updateRoleTool } from './tools/update-role.js';
import { updateWebhookTool } from './tools/update-webhook.js';

export function createDiscordTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    discord_add_guild_member_role: addGuildMemberRoleTool(platformProxy),
    discord_create_channel: createChannelTool(platformProxy),
    discord_create_message: createMessageTool(platformProxy),
    discord_create_reaction: createReactionTool(platformProxy),
    discord_create_role: createRoleTool(platformProxy),
    discord_create_thread_from_message: createThreadFromMessageTool(platformProxy),
    discord_create_webhook: createWebhookTool(platformProxy),
    discord_delete_channel: deleteChannelTool(platformProxy),
    discord_delete_guild_member: deleteGuildMemberTool(platformProxy),
    discord_delete_guild: deleteGuildTool(platformProxy),
    discord_delete_message: deleteMessageTool(platformProxy),
    discord_delete_reaction: deleteReactionTool(platformProxy),
    discord_delete_role: deleteRoleTool(platformProxy),
    discord_delete_webhook: deleteWebhookTool(platformProxy),
    discord_get_channel: getChannelTool(platformProxy),
    discord_get_guild_member: getGuildMemberTool(platformProxy),
    discord_get_guild: getGuildTool(platformProxy),
    discord_get_message: getMessageTool(platformProxy),
    discord_get_role: getRoleTool(platformProxy),
    discord_get_webhook: getWebhookTool(platformProxy),
    discord_list_channels: listChannelsTool(platformProxy),
    discord_list_guild_members: listGuildMembersTool(platformProxy),
    discord_list_guilds: listGuildsTool(platformProxy),
    discord_list_messages: listMessagesTool(platformProxy),
    discord_list_roles: listRolesTool(platformProxy),
    discord_list_webhooks: listWebhooksTool(platformProxy),
    discord_remove_guild_member_role: removeGuildMemberRoleTool(platformProxy),
    discord_update_channel: updateChannelTool(platformProxy),
    discord_update_guild_member: updateGuildMemberTool(platformProxy),
    discord_update_guild: updateGuildTool(platformProxy),
    discord_update_message: updateMessageTool(platformProxy),
    discord_update_role: updateRoleTool(platformProxy),
    discord_update_webhook: updateWebhookTool(platformProxy),
  };
  return applyAllowTools(tools, options?.allowTools);
}
