import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch, probeTool } from '../scenario.js';

/**
 * Deep Discord scenario: creates an ephemeral channel in the first available
 * guild, posts a message, reacts, threads, updates, and deletes everything on
 * the way out. Avoids creating/deleting the guild itself.
 */
export const discordScenario: Scenario = {
  integrationId: 'discord',
  summary: 'channel + message + reaction + thread + role lifecycle',
  async run({ tools, runId, call, log }) {
    const steps: ScenarioStep[] = [];
    const missing = requireTools(tools, [
      'discord_list_guilds',
      'discord_create_channel',
      'discord_create_message',
      'discord_delete_channel',
    ]);
    if (missing) {
      steps.push({ name: 'preflight', status: 'skip', detail: missing });
      return steps;
    }

    const guilds = await call<{ items?: Array<{ id?: string; name?: string }> }>('discord_list_guilds', {});
    const guild = (guilds.items ?? []).find(g => g.id);
    if (!guild?.id) {
      steps.push(makeStep('pick guild', 'discord_list_guilds', 'skip', 'No Discord guild visible.'));
      return steps;
    }
    steps.push(makeStep('pick guild', 'discord_list_guilds', 'pass', guild.name ?? guild.id));

    steps.push(
      ...(await runReadBatch(
        call,
        [
          ['discord_get_guild', { guildId: guild.id }],
          ['discord_list_channels', { guild_id: guild.id }],
          ['discord_list_roles', { guild_id: guild.id }],
          ['discord_list_guild_members', { guild_id: guild.id, limit: 5 }],
          ['discord_search_members', { guild_id: guild.id, query: 'a', limit: 5 }],
        ],
        tools,
      )),
    );

    let channelId: string | undefined;
    try {
      const channel = await call<{ id: string }>('discord_create_channel', {
        guildId: guild.id,
        name: `smoke-${runId}`.slice(0, 90),
        type: 0,
      });
      channelId = channel.id;
      steps.push(makeStep('create channel', 'discord_create_channel', 'pass', channelId));
    } catch (error) {
      steps.push(makeStep('create channel', 'discord_create_channel', 'fail', errorMessage(error)));
      return steps;
    }

    if (tools['discord_get_channel']) {
      try {
        await call('discord_get_channel', { channelId });
        steps.push(makeStep('get channel', 'discord_get_channel', 'pass'));
      } catch (error) {
        steps.push(makeStep('get channel', 'discord_get_channel', 'fail', errorMessage(error)));
      }
    }

    if (tools['discord_update_channel']) {
      try {
        await call('discord_update_channel', {
          channel_id: channelId,
          name: `smoke-${runId}-edited`.slice(0, 90),
        });
        steps.push(makeStep('update channel', 'discord_update_channel', 'pass'));
      } catch (error) {
        steps.push(makeStep('update channel', 'discord_update_channel', 'fail', errorMessage(error)));
      }
    }

    let messageId: string | undefined;
    try {
      const message = await call<{ id: string }>('discord_create_message', {
        channelId,
        content: `${runId} smoke message`,
      });
      messageId = message.id;
      steps.push(makeStep('create message', 'discord_create_message', 'pass', messageId));
    } catch (error) {
      steps.push(makeStep('create message', 'discord_create_message', 'fail', errorMessage(error)));
    }

    if (messageId && tools['discord_get_message']) {
      try {
        await call('discord_get_message', { channelId, messageId });
        steps.push(makeStep('get message', 'discord_get_message', 'pass'));
      } catch (error) {
        steps.push(makeStep('get message', 'discord_get_message', 'fail', errorMessage(error)));
      }
    }

    if (messageId && tools['discord_update_message']) {
      try {
        await call('discord_update_message', {
          channel_id: channelId,
          message_id: messageId,
          content: `${runId} smoke message (edited)`,
        });
        steps.push(makeStep('update message', 'discord_update_message', 'pass'));
      } catch (error) {
        steps.push(makeStep('update message', 'discord_update_message', 'fail', errorMessage(error)));
      }
    }

    if (messageId && tools['discord_create_reaction']) {
      try {
        await call('discord_create_reaction', { channel_id: channelId, message_id: messageId, emoji: '👀' });
        steps.push(makeStep('create reaction', 'discord_create_reaction', 'pass'));
      } catch (error) {
        steps.push(makeStep('create reaction', 'discord_create_reaction', 'fail', errorMessage(error)));
      }
      if (tools['discord_delete_reaction']) {
        try {
          await call('discord_delete_reaction', { channel_id: channelId, message_id: messageId, emoji: '👀' });
          steps.push(makeStep('delete reaction', 'discord_delete_reaction', 'pass'));
        } catch (error) {
          steps.push(makeStep('delete reaction', 'discord_delete_reaction', 'fail', errorMessage(error)));
        }
      }
    }

    let threadId: string | undefined;
    if (messageId && tools['discord_create_thread_from_message']) {
      try {
        const thread = await call<{ id: string }>('discord_create_thread_from_message', {
          channel_id: channelId,
          message_id: messageId,
          name: `${runId}-thread`,
        });
        threadId = thread.id;
        steps.push(makeStep('create thread', 'discord_create_thread_from_message', 'pass', threadId));
      } catch (error) {
        steps.push(makeStep('create thread', 'discord_create_thread_from_message', 'fail', errorMessage(error)));
      }
    }

    if (tools['discord_list_messages']) {
      try {
        await call('discord_list_messages', { channel_id: channelId, limit: 5 });
        steps.push(makeStep('list messages', 'discord_list_messages', 'pass'));
      } catch (error) {
        steps.push(makeStep('list messages', 'discord_list_messages', 'fail', errorMessage(error)));
      }
    }

    let roleId: string | undefined;
    if (tools['discord_create_role']) {
      try {
        const role = await call<{ id: string }>('discord_create_role', {
          guildId: guild.id,
          name: `${runId}-role`,
        });
        roleId = role.id;
        steps.push(makeStep('create role', 'discord_create_role', 'pass', roleId));
      } catch (error) {
        steps.push(makeStep('create role', 'discord_create_role', 'fail', errorMessage(error)));
      }
    }

    if (roleId && tools['discord_get_role']) {
      try {
        await call('discord_get_role', { guild_id: guild.id, role_id: roleId });
        steps.push(makeStep('get role', 'discord_get_role', 'pass'));
      } catch (error) {
        steps.push(makeStep('get role', 'discord_get_role', 'fail', errorMessage(error)));
      }
    }
    if (roleId && tools['discord_update_role']) {
      try {
        await call('discord_update_role', { guildId: guild.id, roleId, name: `${runId}-role-edited` });
        steps.push(makeStep('update role', 'discord_update_role', 'pass'));
      } catch (error) {
        steps.push(makeStep('update role', 'discord_update_role', 'fail', errorMessage(error)));
      }
    }

    // Webhook lifecycle on our smoke channel. list_webhooks is
    // channel-scoped (GET /channels/:id/webhooks), so it runs here rather
    // than in the guild read batch.
    if (tools['discord_list_webhooks']) {
      try {
        await call('discord_list_webhooks', { channelId });
        steps.push(makeStep('list webhooks', 'discord_list_webhooks', 'pass'));
      } catch (error) {
        steps.push(makeStep('list webhooks', 'discord_list_webhooks', 'fail', errorMessage(error)));
      }
    }

    let webhookId: string | undefined;
    if (tools['discord_create_webhook']) {
      try {
        const webhook = await call<{ id: string }>('discord_create_webhook', {
          channelId,
          name: `smoke-${runId}`.slice(0, 80),
        });
        webhookId = webhook.id;
        steps.push(makeStep('create webhook', 'discord_create_webhook', 'pass', webhookId));
      } catch (error) {
        steps.push(makeStep('create webhook', 'discord_create_webhook', 'fail', errorMessage(error)));
      }
    }

    if (webhookId && tools['discord_get_webhook']) {
      try {
        await call('discord_get_webhook', { webhookId });
        steps.push(makeStep('get webhook', 'discord_get_webhook', 'pass'));
      } catch (error) {
        steps.push(makeStep('get webhook', 'discord_get_webhook', 'fail', errorMessage(error)));
      }
    }

    if (webhookId && tools['discord_update_webhook']) {
      try {
        await call('discord_update_webhook', { webhook_id: webhookId, name: `smoke-${runId}-edited`.slice(0, 80) });
        steps.push(makeStep('update webhook', 'discord_update_webhook', 'pass'));
      } catch (error) {
        steps.push(makeStep('update webhook', 'discord_update_webhook', 'fail', errorMessage(error)));
      }
    }

    if (webhookId && tools['discord_delete_webhook']) {
      try {
        await call('discord_delete_webhook', { webhookId });
        steps.push(makeStep('delete webhook', 'discord_delete_webhook', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke webhook ${webhookId} — clean up manually.`, errorMessage(error));
        steps.push(makeStep('delete webhook', 'discord_delete_webhook', 'fail', errorMessage(error)));
      }
    }

    // Guild-member mutations are destructive on real users; probe with a
    // synthetic snowflake and accept the Discord 404 as proof the tool
    // routes to /guilds/:id/members/:user_id.
    const syntheticUserId = `${runId.replace(/[^0-9]/g, '')}00000000000000`.slice(0, 19) || '000000000000000000';
    steps.push(
      await probeTool(call, tools, 'get guild member', 'discord_get_guild_member', {
        guild_id: guild.id,
        user_id: syntheticUserId,
      }),
    );
    steps.push(
      await probeTool(call, tools, 'update guild member', 'discord_update_guild_member', {
        guild_id: guild.id,
        user_id: syntheticUserId,
        nick: `smoke-${runId}`,
      }),
    );
    if (roleId) {
      steps.push(
        await probeTool(call, tools, 'add guild member role', 'discord_add_guild_member_role', {
          guildId: guild.id,
          userId: syntheticUserId,
          roleId,
        }),
      );
      steps.push(
        await probeTool(call, tools, 'remove guild member role', 'discord_remove_guild_member_role', {
          guild_id: guild.id,
          user_id: syntheticUserId,
          role_id: roleId,
        }),
      );
    }
    steps.push(
      await probeTool(call, tools, 'delete guild member', 'discord_delete_guild_member', {
        guild_id: guild.id,
        user_id: syntheticUserId,
      }),
    );

    // Guild mutations are even more destructive (delete_guild removes the
    // bot from the guild entirely); probe with a synthetic guild id.
    const syntheticGuildId = `${runId.replace(/[^0-9]/g, '')}11111111111111`.slice(0, 19) || '111111111111111111';
    steps.push(
      await probeTool(call, tools, 'update guild', 'discord_update_guild', {
        guild_id: syntheticGuildId,
        name: `smoke-${runId}`,
      }),
    );
    steps.push(await probeTool(call, tools, 'delete guild', 'discord_delete_guild', { guild_id: syntheticGuildId }));

    if (roleId && tools['discord_delete_role']) {
      try {
        await call('discord_delete_role', { guildId: guild.id, roleId });
        steps.push(makeStep('delete role', 'discord_delete_role', 'pass'));
      } catch (error) {
        log.error(`Failed to delete smoke role ${roleId} — clean up manually.`, errorMessage(error));
        steps.push(makeStep('delete role', 'discord_delete_role', 'fail', errorMessage(error)));
      }
    }

    if (messageId && tools['discord_delete_message']) {
      try {
        await call('discord_delete_message', { channelId, messageId });
        steps.push(makeStep('delete message', 'discord_delete_message', 'pass'));
      } catch (error) {
        steps.push(makeStep('delete message', 'discord_delete_message', 'fail', errorMessage(error)));
      }
    }

    try {
      await call('discord_delete_channel', { channelId });
      steps.push(makeStep('delete channel', 'discord_delete_channel', 'pass'));
    } catch (error) {
      log.error(`Failed to delete smoke channel ${channelId} — clean up manually.`, errorMessage(error));
      steps.push(makeStep('delete channel', 'discord_delete_channel', 'fail', errorMessage(error)));
    }

    return steps;
  },
};
