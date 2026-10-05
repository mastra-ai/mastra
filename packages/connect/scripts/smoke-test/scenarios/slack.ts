import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch, probeTool } from '../scenario.js';

/**
 * Deep Slack scenario: channel + message + reaction + pin lifecycle. Avoids
 * side effects outside the scenario's own channel: creates a dedicated
 * ephemeral channel, posts into it, then archives it (Slack cannot hard-delete).
 */
export const slackScenario: Scenario = {
  integrationId: 'slack',
  summary: 'channel + message + reaction + pin lifecycle',
  async run({ tools, runId, call, log }) {
    const steps: ScenarioStep[] = [];
    const missing = requireTools(tools, [
      'slack_list_channels',
      'slack_create_channel',
      'slack_post_message',
      'slack_update_message',
      'slack_delete_message',
      'slack_archive_channel',
    ]);
    if (missing) {
      steps.push({ name: 'preflight', status: 'skip', detail: missing });
      return steps;
    }

    steps.push(
      ...(await runReadBatch(
        call,
        [
          ['slack_get_team_info', {}],
          ['slack_list_users', {}],
          ['slack_list_channels', { limit: 5 }],
          ['slack_list_user_groups', {}],
          ['slack_list_custom_emoji', {}],
        ],
        tools,
      )),
    );

    const channelName = `smoke-${runId}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .slice(0, 21);
    let channelId: string | undefined;
    try {
      const channel = await call<{ channel: { id: string; name: string } }>('slack_create_channel', {
        name: channelName,
        is_private: false,
      });
      channelId = channel.channel.id;
      steps.push(makeStep('create channel', 'slack_create_channel', 'pass', channelId));
    } catch (error) {
      steps.push(makeStep('create channel', 'slack_create_channel', 'fail', errorMessage(error)));
      return steps;
    }

    let messageTs: string | undefined;
    try {
      const message = await call<{ ts: string }>('slack_post_message', {
        channel: channelId,
        text: `${runId} smoke message`,
      });
      messageTs = message.ts;
      steps.push(makeStep('post message', 'slack_post_message', 'pass', messageTs));
    } catch (error) {
      steps.push(makeStep('post message', 'slack_post_message', 'fail', errorMessage(error)));
    }

    if (messageTs && tools['slack_update_message']) {
      try {
        await call('slack_update_message', {
          channel_id: channelId,
          message_ts: messageTs,
          text: `${runId} smoke message (edited)`,
        });
        steps.push(makeStep('update message', 'slack_update_message', 'pass'));
      } catch (error) {
        steps.push(makeStep('update message', 'slack_update_message', 'fail', errorMessage(error)));
      }
    }

    if (messageTs && tools['slack_add_reaction']) {
      try {
        await call('slack_add_reaction', { channel_id: channelId, timestamp: messageTs, emoji_name: 'eyes' });
        steps.push(makeStep('add reaction', 'slack_add_reaction', 'pass'));
      } catch (error) {
        steps.push(makeStep('add reaction', 'slack_add_reaction', 'fail', errorMessage(error)));
      }
      if (tools['slack_remove_reaction']) {
        try {
          await call('slack_remove_reaction', { channel_id: channelId, timestamp: messageTs, reaction_name: 'eyes' });
          steps.push(makeStep('remove reaction', 'slack_remove_reaction', 'pass'));
        } catch (error) {
          steps.push(makeStep('remove reaction', 'slack_remove_reaction', 'fail', errorMessage(error)));
        }
      }
    }

    if (messageTs && tools['slack_pin_message']) {
      try {
        await call('slack_pin_message', { channel_id: channelId, message_timestamp: messageTs });
        steps.push(makeStep('pin message', 'slack_pin_message', 'pass'));
      } catch (error) {
        steps.push(makeStep('pin message', 'slack_pin_message', 'fail', errorMessage(error)));
      }
      if (tools['slack_unpin_message']) {
        try {
          await call('slack_unpin_message', { channel_id: channelId, timestamp: messageTs });
          steps.push(makeStep('unpin message', 'slack_unpin_message', 'pass'));
        } catch (error) {
          steps.push(makeStep('unpin message', 'slack_unpin_message', 'fail', errorMessage(error)));
        }
      }
    }

    if (tools['slack_get_channel_info']) {
      try {
        await call('slack_get_channel_info', { channel_id: channelId });
        steps.push(makeStep('read channel info', 'slack_get_channel_info', 'pass'));
      } catch (error) {
        steps.push(makeStep('read channel info', 'slack_get_channel_info', 'fail', errorMessage(error)));
      }
    }

    if (tools['slack_set_channel_topic']) {
      try {
        await call('slack_set_channel_topic', { channel_id: channelId, topic: `${runId} smoke topic` });
        steps.push(makeStep('set channel topic', 'slack_set_channel_topic', 'pass'));
      } catch (error) {
        steps.push(makeStep('set channel topic', 'slack_set_channel_topic', 'fail', errorMessage(error)));
      }
    }

    if (tools['slack_get_conversation_history']) {
      try {
        await call('slack_get_conversation_history', { channel_id: channelId, limit: 5 });
        steps.push(makeStep('read conversation history', 'slack_get_conversation_history', 'pass'));
      } catch (error) {
        steps.push(
          makeStep('read conversation history', 'slack_get_conversation_history', 'fail', errorMessage(error)),
        );
      }
    }

    // Channel membership + metadata operations.
    if (tools['slack_join_channel']) {
      try {
        await call('slack_join_channel', { channel_id: channelId });
        steps.push(makeStep('join channel', 'slack_join_channel', 'pass'));
      } catch (error) {
        steps.push(makeStep('join channel', 'slack_join_channel', 'fail', errorMessage(error)));
      }
    }
    if (tools['slack_get_channel_members']) {
      try {
        await call('slack_get_channel_members', { channel_id: channelId, limit: 5 });
        steps.push(makeStep('get channel members', 'slack_get_channel_members', 'pass'));
      } catch (error) {
        steps.push(makeStep('get channel members', 'slack_get_channel_members', 'fail', errorMessage(error)));
      }
    }
    if (tools['slack_set_channel_purpose']) {
      try {
        await call('slack_set_channel_purpose', { channel_id: channelId, purpose: 'mastra smoke test channel' });
        steps.push(makeStep('set channel purpose', 'slack_set_channel_purpose', 'pass'));
      } catch (error) {
        steps.push(makeStep('set channel purpose', 'slack_set_channel_purpose', 'fail', errorMessage(error)));
      }
    }
    if (tools['slack_rename_channel']) {
      try {
        await call('slack_rename_channel', { channel_id: channelId, channel_name: `${channelName}r` });
        steps.push(makeStep('rename channel', 'slack_rename_channel', 'pass'));
      } catch (error) {
        steps.push(makeStep('rename channel', 'slack_rename_channel', 'fail', errorMessage(error)));
      }
    }
    if (tools['slack_invite_to_channel']) {
      steps.push(
        await probeTool(call, tools, 'invite to channel (probe)', 'slack_invite_to_channel', {
          channel_id: channelId,
          user_ids: ['U000SMOKE000'],
        }),
      );
    }
    if (tools['slack_invite_shared']) {
      steps.push(
        await probeTool(call, tools, 'invite shared (probe)', 'slack_invite_shared', {
          channel_id: channelId,
          emails: [`smoke+${runId}@mastra-smoke.invalid`],
        }),
      );
    }
    if (tools['slack_remove_from_channel']) {
      steps.push(
        await probeTool(call, tools, 'remove from channel (probe)', 'slack_remove_from_channel', {
          channel_id: channelId,
          user_id: 'U000SMOKE000',
        }),
      );
    }

    // Message-level getters.
    if (messageTs && tools['slack_get_reactions']) {
      try {
        await call('slack_get_reactions', { channel_id: channelId, timestamp: messageTs });
        steps.push(makeStep('get reactions', 'slack_get_reactions', 'pass'));
      } catch (error) {
        steps.push(makeStep('get reactions', 'slack_get_reactions', 'fail', errorMessage(error)));
      }
    }
    if (messageTs && tools['slack_get_message_permalink']) {
      try {
        await call('slack_get_message_permalink', { channel_id: channelId, message_ts: messageTs });
        steps.push(makeStep('get message permalink', 'slack_get_message_permalink', 'pass'));
      } catch (error) {
        steps.push(makeStep('get message permalink', 'slack_get_message_permalink', 'fail', errorMessage(error)));
      }
    }
    if (messageTs && tools['slack_get_thread_replies']) {
      try {
        await call('slack_get_thread_replies', { channel_id: channelId, thread_ts: messageTs });
        steps.push(makeStep('get thread replies', 'slack_get_thread_replies', 'pass'));
      } catch (error) {
        steps.push(makeStep('get thread replies', 'slack_get_thread_replies', 'fail', errorMessage(error)));
      }
    }
    if (messageTs && tools['slack_mark_as_read']) {
      try {
        await call('slack_mark_as_read', { channel_id: channelId, message_ts: messageTs });
        steps.push(makeStep('mark as read', 'slack_mark_as_read', 'pass'));
      } catch (error) {
        steps.push(makeStep('mark as read', 'slack_mark_as_read', 'fail', errorMessage(error)));
      }
    }

    // Pins + files listings on the smoke channel.
    if (tools['slack_list_pins']) {
      try {
        await call('slack_list_pins', { channel_id: channelId });
        steps.push(makeStep('list pins', 'slack_list_pins', 'pass'));
      } catch (error) {
        steps.push(makeStep('list pins', 'slack_list_pins', 'fail', errorMessage(error)));
      }
    }
    if (tools['slack_list_files']) {
      try {
        await call('slack_list_files', { channel_id: channelId, limit: 5 });
        steps.push(makeStep('list files', 'slack_list_files', 'pass'));
      } catch (error) {
        steps.push(makeStep('list files', 'slack_list_files', 'fail', errorMessage(error)));
      }
    }
    if (tools['slack_search_files']) {
      try {
        await call('slack_search_files', { query: runId, count: 1 });
        steps.push(makeStep('search files', 'slack_search_files', 'pass'));
      } catch (error) {
        steps.push(makeStep('search files', 'slack_search_files', 'fail', errorMessage(error)));
      }
    }
    if (tools['slack_search_messages']) {
      try {
        await call('slack_search_messages', { query: runId, count: 1 });
        steps.push(makeStep('search messages', 'slack_search_messages', 'pass'));
      } catch (error) {
        steps.push(makeStep('search messages', 'slack_search_messages', 'fail', errorMessage(error)));
      }
    }
    if (tools['slack_get_upload_url']) {
      try {
        await call('slack_get_upload_url', { filename: `smoke-${runId}.txt`, length: 42 });
        steps.push(makeStep('get upload url', 'slack_get_upload_url', 'pass'));
      } catch (error) {
        steps.push(makeStep('get upload url', 'slack_get_upload_url', 'fail', errorMessage(error)));
      }
    }

    // Alternate message post variant + ephemeral + schedule/cancel.
    if (tools['slack_send_message']) {
      try {
        await call('slack_send_message', { channel_id: channelId, text: `${runId} send_message variant` });
        steps.push(makeStep('send message', 'slack_send_message', 'pass'));
      } catch (error) {
        steps.push(makeStep('send message', 'slack_send_message', 'fail', errorMessage(error)));
      }
    }
    if (tools['slack_send_ephemeral_message']) {
      steps.push(
        await probeTool(call, tools, 'send ephemeral message (probe)', 'slack_send_ephemeral_message', {
          channel_id: channelId,
          user_id: 'U000SMOKE000',
          text: `${runId} ephemeral`,
        }),
      );
    }
    let scheduledId: string | undefined;
    if (tools['slack_schedule_message']) {
      try {
        const scheduled = await call<{ scheduled_message_id?: string }>('slack_schedule_message', {
          channel_id: channelId,
          text: `${runId} scheduled`,
          post_at: Math.floor(Date.now() / 1000) + 3600,
        });
        scheduledId = scheduled.scheduled_message_id;
        steps.push(makeStep('schedule message', 'slack_schedule_message', 'pass', scheduledId));
      } catch (error) {
        steps.push(makeStep('schedule message', 'slack_schedule_message', 'fail', errorMessage(error)));
      }
    }
    if (tools['slack_list_scheduled_messages']) {
      try {
        await call('slack_list_scheduled_messages', { channel_id: channelId, limit: 5 });
        steps.push(makeStep('list scheduled messages', 'slack_list_scheduled_messages', 'pass'));
      } catch (error) {
        steps.push(makeStep('list scheduled messages', 'slack_list_scheduled_messages', 'fail', errorMessage(error)));
      }
    }
    if (scheduledId && tools['slack_delete_scheduled_message']) {
      try {
        await call('slack_delete_scheduled_message', { channel: channelId, scheduled_message_id: scheduledId });
        steps.push(makeStep('delete scheduled message', 'slack_delete_scheduled_message', 'pass'));
      } catch (error) {
        steps.push(makeStep('delete scheduled message', 'slack_delete_scheduled_message', 'fail', errorMessage(error)));
      }
    } else if (tools['slack_delete_scheduled_message']) {
      steps.push(
        await probeTool(call, tools, 'delete scheduled message (probe)', 'slack_delete_scheduled_message', {
          channel: channelId,
          scheduled_message_id: `smoke-${runId}`,
        }),
      );
    }

    // Reminder lifecycle (synthetic future time).
    if (tools['slack_create_reminder']) {
      try {
        await call('slack_create_reminder', {
          text: `${runId} smoke reminder`,
          time: Math.floor(Date.now() / 1000) + 3600,
        });
        steps.push(makeStep('create reminder', 'slack_create_reminder', 'pass'));
      } catch (error) {
        steps.push(makeStep('create reminder', 'slack_create_reminder', 'fail', errorMessage(error)));
      }
    }

    // User/profile/presence read surface against the authenticated user.
    if (tools['slack_get_user_info']) {
      steps.push(
        await probeTool(call, tools, 'get user info (probe)', 'slack_get_user_info', { user_id: 'USMOKE000' }),
      );
    }
    if (tools['slack_get_user_profile']) {
      steps.push(
        await probeTool(call, tools, 'get user profile (probe)', 'slack_get_user_profile', {
          user_id: 'USMOKE000',
        }),
      );
    }
    if (tools['slack_get_user_presence']) {
      try {
        await call('slack_get_user_presence', {});
        steps.push(makeStep('get user presence', 'slack_get_user_presence', 'pass'));
      } catch (error) {
        steps.push(makeStep('get user presence', 'slack_get_user_presence', 'fail', errorMessage(error)));
      }
    }
    if (tools['slack_get_dnd_info']) {
      try {
        await call('slack_get_dnd_info', {});
        steps.push(makeStep('get dnd info', 'slack_get_dnd_info', 'pass'));
      } catch (error) {
        steps.push(makeStep('get dnd info', 'slack_get_dnd_info', 'fail', errorMessage(error)));
      }
    }
    if (tools['slack_lookup_user_by_email']) {
      steps.push(
        await probeTool(call, tools, 'lookup user by email (probe)', 'slack_lookup_user_by_email', {
          email: `smoke+${runId}@mastra-smoke.invalid`,
        }),
      );
    }
    if (tools['slack_list_user_group_members']) {
      steps.push(
        await probeTool(call, tools, 'list user group members (probe)', 'slack_list_user_group_members', {
          usergroup_id: 'SSMOKE000',
        }),
      );
    }
    if (tools['slack_list_user_reactions']) {
      try {
        await call('slack_list_user_reactions', { limit: 5 });
        steps.push(makeStep('list user reactions', 'slack_list_user_reactions', 'pass'));
      } catch (error) {
        steps.push(makeStep('list user reactions', 'slack_list_user_reactions', 'fail', errorMessage(error)));
      }
    }
    if (tools['slack_open_dm']) {
      steps.push(await probeTool(call, tools, 'open dm (probe)', 'slack_open_dm', { user_ids: ['USMOKE000'] }));
    }
    // Status + presence are user-level toggles; set to safe neutral values.
    if (tools['slack_set_status']) {
      try {
        await call('slack_set_status', { status_text: '', status_emoji: '' });
        steps.push(makeStep('set status', 'slack_set_status', 'pass'));
      } catch (error) {
        steps.push(makeStep('set status', 'slack_set_status', 'fail', errorMessage(error)));
      }
    }
    if (tools['slack_set_user_presence']) {
      try {
        await call('slack_set_user_presence', { presence: 'online' });
        steps.push(makeStep('set user presence', 'slack_set_user_presence', 'pass'));
      } catch (error) {
        steps.push(makeStep('set user presence', 'slack_set_user_presence', 'fail', errorMessage(error)));
      }
    }

    // unarchive_channel exercises on a channel that's not archived yet (expected 400).
    if (tools['slack_unarchive_channel']) {
      steps.push(
        await probeTool(call, tools, 'unarchive channel (probe)', 'slack_unarchive_channel', {
          channel_id: channelId,
        }),
      );
    }

    // Leave the smoke channel before archiving (optional but exercises leave).
    if (tools['slack_leave_channel']) {
      try {
        await call('slack_leave_channel', { channel_id: channelId });
        steps.push(makeStep('leave channel', 'slack_leave_channel', 'pass'));
      } catch (error) {
        steps.push(makeStep('leave channel', 'slack_leave_channel', 'fail', errorMessage(error)));
      }
    }

    if (messageTs) {
      try {
        await call('slack_delete_message', { channel_id: channelId, message_ts: messageTs });
        steps.push(makeStep('delete message', 'slack_delete_message', 'pass'));
      } catch (error) {
        steps.push(makeStep('delete message', 'slack_delete_message', 'fail', errorMessage(error)));
      }
    }

    try {
      await call('slack_archive_channel', { channel_id: channelId });
      steps.push(makeStep('archive channel', 'slack_archive_channel', 'pass'));
    } catch (error) {
      log.error(`Failed to archive smoke channel ${channelId} — clean up manually.`, errorMessage(error));
      steps.push(makeStep('archive channel', 'slack_archive_channel', 'fail', errorMessage(error)));
    }

    return steps;
  },
};
