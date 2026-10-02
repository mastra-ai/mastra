import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch } from '../scenario.js';

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
          ['slack_list_users', { limit: 5 }],
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
          channel: channelId,
          ts: messageTs,
          text: `${runId} smoke message (edited)`,
        });
        steps.push(makeStep('update message', 'slack_update_message', 'pass'));
      } catch (error) {
        steps.push(makeStep('update message', 'slack_update_message', 'fail', errorMessage(error)));
      }
    }

    if (messageTs && tools['slack_add_reaction']) {
      try {
        await call('slack_add_reaction', { channel: channelId, timestamp: messageTs, name: 'eyes' });
        steps.push(makeStep('add reaction', 'slack_add_reaction', 'pass'));
      } catch (error) {
        steps.push(makeStep('add reaction', 'slack_add_reaction', 'fail', errorMessage(error)));
      }
      if (tools['slack_remove_reaction']) {
        try {
          await call('slack_remove_reaction', { channel: channelId, timestamp: messageTs, name: 'eyes' });
          steps.push(makeStep('remove reaction', 'slack_remove_reaction', 'pass'));
        } catch (error) {
          steps.push(makeStep('remove reaction', 'slack_remove_reaction', 'fail', errorMessage(error)));
        }
      }
    }

    if (messageTs && tools['slack_pin_message']) {
      try {
        await call('slack_pin_message', { channel: channelId, timestamp: messageTs });
        steps.push(makeStep('pin message', 'slack_pin_message', 'pass'));
      } catch (error) {
        steps.push(makeStep('pin message', 'slack_pin_message', 'fail', errorMessage(error)));
      }
      if (tools['slack_unpin_message']) {
        try {
          await call('slack_unpin_message', { channel: channelId, timestamp: messageTs });
          steps.push(makeStep('unpin message', 'slack_unpin_message', 'pass'));
        } catch (error) {
          steps.push(makeStep('unpin message', 'slack_unpin_message', 'fail', errorMessage(error)));
        }
      }
    }

    if (tools['slack_get_channel_info']) {
      try {
        await call('slack_get_channel_info', { channel: channelId });
        steps.push(makeStep('read channel info', 'slack_get_channel_info', 'pass'));
      } catch (error) {
        steps.push(makeStep('read channel info', 'slack_get_channel_info', 'fail', errorMessage(error)));
      }
    }

    if (tools['slack_set_channel_topic']) {
      try {
        await call('slack_set_channel_topic', { channel: channelId, topic: `${runId} smoke topic` });
        steps.push(makeStep('set channel topic', 'slack_set_channel_topic', 'pass'));
      } catch (error) {
        steps.push(makeStep('set channel topic', 'slack_set_channel_topic', 'fail', errorMessage(error)));
      }
    }

    if (tools['slack_get_conversation_history']) {
      try {
        await call('slack_get_conversation_history', { channel: channelId, limit: 5 });
        steps.push(makeStep('read conversation history', 'slack_get_conversation_history', 'pass'));
      } catch (error) {
        steps.push(
          makeStep('read conversation history', 'slack_get_conversation_history', 'fail', errorMessage(error)),
        );
      }
    }

    if (messageTs) {
      try {
        await call('slack_delete_message', { channel: channelId, ts: messageTs });
        steps.push(makeStep('delete message', 'slack_delete_message', 'pass'));
      } catch (error) {
        steps.push(makeStep('delete message', 'slack_delete_message', 'fail', errorMessage(error)));
      }
    }

    try {
      await call('slack_archive_channel', { channel: channelId });
      steps.push(makeStep('archive channel', 'slack_archive_channel', 'pass'));
    } catch (error) {
      log.error(`Failed to archive smoke channel ${channelId} — clean up manually.`, errorMessage(error));
      steps.push(makeStep('archive channel', 'slack_archive_channel', 'fail', errorMessage(error)));
    }

    return steps;
  },
};
