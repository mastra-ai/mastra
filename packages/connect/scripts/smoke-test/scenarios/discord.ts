import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch } from '../scenario.js';

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
          ['discord_list_channels', { guildId: guild.id }],
          ['discord_list_roles', { guildId: guild.id }],
          ['discord_list_guild_members', { guildId: guild.id, limit: 5 }],
          ['discord_list_webhooks', { guildId: guild.id }],
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

    if (messageId && tools['discord_update_message']) {
      try {
        await call('discord_update_message', {
          channelId,
          messageId,
          content: `${runId} smoke message (edited)`,
        });
        steps.push(makeStep('update message', 'discord_update_message', 'pass'));
      } catch (error) {
        steps.push(makeStep('update message', 'discord_update_message', 'fail', errorMessage(error)));
      }
    }

    if (messageId && tools['discord_create_reaction']) {
      try {
        await call('discord_create_reaction', { channelId, messageId, emoji: '👀' });
        steps.push(makeStep('create reaction', 'discord_create_reaction', 'pass'));
      } catch (error) {
        steps.push(makeStep('create reaction', 'discord_create_reaction', 'fail', errorMessage(error)));
      }
      if (tools['discord_delete_reaction']) {
        try {
          await call('discord_delete_reaction', { channelId, messageId, emoji: '👀' });
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
          channelId,
          messageId,
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
        await call('discord_list_messages', { channelId, limit: 5 });
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

    if (roleId && tools['discord_update_role']) {
      try {
        await call('discord_update_role', { guildId: guild.id, roleId, name: `${runId}-role-edited` });
        steps.push(makeStep('update role', 'discord_update_role', 'pass'));
      } catch (error) {
        steps.push(makeStep('update role', 'discord_update_role', 'fail', errorMessage(error)));
      }
    }
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
