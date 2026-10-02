import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch } from '../scenario.js';

/**
 * Deep Microsoft Teams scenario: channel + message + reply lifecycle inside
 * the first joined team the token can post to. Avoids create-team/delete-team
 * (admin-tier) and chat-create (DM side effects).
 */
export const microsoftTeamsScenario: Scenario = {
  integrationId: 'microsoft-teams',
  summary: 'channel + message + reply lifecycle inside an existing team',
  async run({ tools, runId, call, log }) {
    const steps: ScenarioStep[] = [];
    const missing = requireTools(tools, [
      'microsoft_teams_list_joined_teams',
      'microsoft_teams_create_channel',
      'microsoft_teams_create_channel_message',
      'microsoft_teams_delete_channel',
    ]);
    if (missing) {
      steps.push({ name: 'preflight', status: 'skip', detail: missing });
      return steps;
    }

    const joined = await call<{ items?: Array<{ id?: string; displayName?: string }> }>(
      'microsoft_teams_list_joined_teams',
      {},
    );
    const team = (joined.items ?? []).find(t => t.id);
    if (!team?.id) {
      steps.push(makeStep('pick team', 'microsoft_teams_list_joined_teams', 'skip', 'No joined teams visible.'));
      return steps;
    }
    steps.push(makeStep('pick team', 'microsoft_teams_list_joined_teams', 'pass', team.displayName ?? team.id));

    steps.push(
      ...(await runReadBatch(
        call,
        [
          ['microsoft_teams_get_team', { teamId: team.id }],
          ['microsoft_teams_list_channels', { teamId: team.id }],
          ['microsoft_teams_list_team_members', { teamId: team.id }],
          ['microsoft_teams_list_chats', { top: 5 }],
        ],
        tools,
      )),
    );

    let channelId: string | undefined;
    try {
      const channel = await call<{ id: string }>('microsoft_teams_create_channel', {
        teamId: team.id,
        displayName: `smoke-${runId}`.slice(0, 50),
        description: 'Automated @mastra/connect smoke test. Safe to delete.',
      });
      channelId = channel.id;
      steps.push(makeStep('create channel', 'microsoft_teams_create_channel', 'pass', channelId));
    } catch (error) {
      steps.push(makeStep('create channel', 'microsoft_teams_create_channel', 'fail', errorMessage(error)));
      return steps;
    }

    let messageId: string | undefined;
    try {
      const message = await call<{ id: string }>('microsoft_teams_create_channel_message', {
        teamId: team.id,
        channelId,
        content: `${runId} smoke message`,
      });
      messageId = message.id;
      steps.push(makeStep('create message', 'microsoft_teams_create_channel_message', 'pass', messageId));
    } catch (error) {
      steps.push(makeStep('create message', 'microsoft_teams_create_channel_message', 'fail', errorMessage(error)));
    }

    if (messageId && tools['microsoft_teams_reply_to_channel_message']) {
      try {
        await call('microsoft_teams_reply_to_channel_message', {
          teamId: team.id,
          channelId,
          messageId,
          content: `${runId} smoke reply`,
        });
        steps.push(makeStep('reply to message', 'microsoft_teams_reply_to_channel_message', 'pass'));
      } catch (error) {
        steps.push(
          makeStep('reply to message', 'microsoft_teams_reply_to_channel_message', 'fail', errorMessage(error)),
        );
      }
    }

    if (tools['microsoft_teams_list_channel_messages']) {
      try {
        await call('microsoft_teams_list_channel_messages', { teamId: team.id, channelId, top: 5 });
        steps.push(makeStep('list channel messages', 'microsoft_teams_list_channel_messages', 'pass'));
      } catch (error) {
        steps.push(
          makeStep('list channel messages', 'microsoft_teams_list_channel_messages', 'fail', errorMessage(error)),
        );
      }
    }

    try {
      await call('microsoft_teams_delete_channel', { teamId: team.id, channelId });
      steps.push(makeStep('delete channel', 'microsoft_teams_delete_channel', 'pass'));
    } catch (error) {
      log.error(`Failed to delete smoke channel ${channelId} — clean up manually.`, errorMessage(error));
      steps.push(makeStep('delete channel', 'microsoft_teams_delete_channel', 'fail', errorMessage(error)));
    }

    return steps;
  },
};
