import { z } from 'zod';

import { IntegrationAction, MakeAPI } from '../../types';
import slackIcon from '../assets/slack.svg';
import { SLACK_INTEGRATION_NAME } from '../constants';
import { INVITE_TO_CHANNEL_SCHEMA } from '../schemas';
import { MakeClient } from '../types';

export const INVITE_TO_CHANNEL = ({
  makeAPI,
  makeClient,
}: {
  makeAPI: MakeAPI;
  makeClient: MakeClient;
}): IntegrationAction<z.infer<typeof INVITE_TO_CHANNEL_SCHEMA>> => ({
  pluginName: SLACK_INTEGRATION_NAME,
  executor: async ({ data, userId, workspaceId }) => {
    const api = makeAPI({ context: { workspaceId, userId } });
    const client = await makeClient({ api });

    const { channelId, users } = data;

    if (!users?.length) return;

    await client.invite({ channelId, users });
  },
  type: 'INVITE_TO_CHANNEL',
  description: 'Invite users to a channel',
  label: 'Invite to Channel',
  schema: INVITE_TO_CHANNEL_SCHEMA,
  icon: {
    icon: slackIcon,
    type: 'plugin',
  },
  async getSchemaOptions({ ctx }) {
    const usersSet = new Set<any>();

    const api = makeAPI({ context: ctx });
    const client = await makeClient({ api });

    const users = await client.getActiveUsers();
    const channels = await client.getAllChannels();

    users?.forEach(user => {
      usersSet.add(user);
    });

    const schemaOptions = Array.from(usersSet).map(user => {
      return {
        label: user.name,
        value: user.id,
      };
    });

    const channelOptions = channels?.map(channel => {
      return {
        label: channel.name ?? '',
        value: channel.id ?? '',
      };
    });

    return {
      users: { options: schemaOptions },
      channelId: { options: channelOptions ?? [] },
    };
  },
});
