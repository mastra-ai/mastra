import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch, probeTool } from '../scenario.js';

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
        body: { contentType: 'text', content: `${runId} smoke message` },
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
          bodyContent: `${runId} smoke reply`,
          bodyContentType: 'text',
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
        await call('microsoft_teams_list_channel_messages', { team_id: team.id, channel_id: channelId });
        steps.push(makeStep('list channel messages', 'microsoft_teams_list_channel_messages', 'pass'));
      } catch (error) {
        steps.push(
          makeStep('list channel messages', 'microsoft_teams_list_channel_messages', 'fail', errorMessage(error)),
        );
      }
    }

    if (tools['microsoft_teams_get_channel']) {
      try {
        await call('microsoft_teams_get_channel', { teamId: team.id, channelId });
        steps.push(makeStep('get channel', 'microsoft_teams_get_channel', 'pass'));
      } catch (error) {
        steps.push(makeStep('get channel', 'microsoft_teams_get_channel', 'fail', errorMessage(error)));
      }
    }

    if (tools['microsoft_teams_update_channel']) {
      try {
        await call('microsoft_teams_update_channel', {
          teamId: team.id,
          channelId,
          description: `smoke ${runId} updated`,
        });
        steps.push(makeStep('update channel', 'microsoft_teams_update_channel', 'pass'));
      } catch (error) {
        steps.push(makeStep('update channel', 'microsoft_teams_update_channel', 'fail', errorMessage(error)));
      }
    }

    if (messageId && tools['microsoft_teams_get_channel_message']) {
      try {
        await call('microsoft_teams_get_channel_message', { teamId: team.id, channelId, messageId });
        steps.push(makeStep('get channel message', 'microsoft_teams_get_channel_message', 'pass'));
      } catch (error) {
        steps.push(makeStep('get channel message', 'microsoft_teams_get_channel_message', 'fail', errorMessage(error)));
      }
    }

    if (messageId && tools['microsoft_teams_list_channel_replies']) {
      try {
        await call('microsoft_teams_list_channel_replies', { teamId: team.id, channelId, messageId });
        steps.push(makeStep('list channel replies', 'microsoft_teams_list_channel_replies', 'pass'));
      } catch (error) {
        steps.push(
          makeStep('list channel replies', 'microsoft_teams_list_channel_replies', 'fail', errorMessage(error)),
        );
      }
    }

    if (tools['microsoft_teams_list_channel_tabs']) {
      try {
        await call('microsoft_teams_list_channel_tabs', { teamId: team.id, channelId });
        steps.push(makeStep('list channel tabs', 'microsoft_teams_list_channel_tabs', 'pass'));
      } catch (error) {
        steps.push(makeStep('list channel tabs', 'microsoft_teams_list_channel_tabs', 'fail', errorMessage(error)));
      }
    }

    // Chat/tab/team-member creation requires a target user id. Probe with a
    // synthetic Graph user id; Microsoft Graph returns 400/404 which still
    // proves routing.
    const syntheticUser = '00000000-0000-0000-0000-000000000000';
    steps.push(
      await probeTool(call, tools, 'create chat', 'microsoft_teams_create_chat', {
        chatType: 'oneOnOne',
        members: [{ user_id: syntheticUser, roles: ['owner'] }],
      }),
    );
    steps.push(
      await probeTool(call, tools, 'create chat message', 'microsoft_teams_create_chat_message', {
        chatId: '19:smoke@thread.v2',
        content: `smoke ${runId}`,
      }),
    );
    steps.push(await probeTool(call, tools, 'get chat', 'microsoft_teams_get_chat', { id: '19:smoke@thread.v2' }));
    steps.push(
      await probeTool(call, tools, 'get chat message', 'microsoft_teams_get_chat_message', {
        chatId: '19:smoke@thread.v2',
        messageId: '1',
      }),
    );
    steps.push(
      await probeTool(call, tools, 'list chat messages', 'microsoft_teams_list_chat_messages', {
        chatId: '19:smoke@thread.v2',
      }),
    );
    steps.push(
      await probeTool(call, tools, 'list chat members', 'microsoft_teams_list_chat_members', {
        chat_id: '19:smoke@thread.v2',
      }),
    );
    steps.push(
      await probeTool(call, tools, 'create channel tab', 'microsoft_teams_create_channel_tab', {
        teamId: team.id,
        channelId,
        displayName: `smoke ${runId}`,
        teamsAppOdataBind: 'https://graph.microsoft.com/v1.0/appCatalogs/teamsApps/com.microsoft.teamspace.tab.web',
      }),
    );
    steps.push(
      await probeTool(call, tools, 'add team member', 'microsoft_teams_add_team_member', {
        teamId: team.id,
        userId: syntheticUser,
      }),
    );
    steps.push(
      await probeTool(call, tools, 'remove team member', 'microsoft_teams_remove_team_member', {
        teamId: team.id,
        membershipId: '00000000-0000-0000-0000-000000000000',
      }),
    );
    // create_team provisions an entire team and nothing here could delete it.
    // Probe with a nonexistent template binding so the request lands in Graph
    // but is rejected (400) before any resource is created — 'standard' would
    // really provision a team on tenants where the app has Team.Create.
    steps.push(
      await probeTool(call, tools, 'create team (probe)', 'microsoft_teams_create_team', {
        display_name: `smoke-${runId}`,
        template: `smoke-invalid-template-${runId}`,
      }),
    );

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
