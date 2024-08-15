import { z } from 'zod';

import { IntegrationAction, MakeAPI } from '../../types';
import slackIcon from '../assets/slack.svg';
import { SLACK_INTEGRATION_NAME } from '../constants';
import { CREATE_NEW_CHANNEL_SCHEMA, CREATE_NEW_CHANNEL_OUTPUT_SCHEMA } from '../schemas';
import { MakeClient } from '../types';

export const CREATE_NEW_CHANNEL = ({
  makeAPI,
  makeClient,
}: {
  makeAPI: MakeAPI;
  makeClient: MakeClient;
}): IntegrationAction<z.infer<typeof CREATE_NEW_CHANNEL_SCHEMA>, z.infer<typeof CREATE_NEW_CHANNEL_OUTPUT_SCHEMA>> => ({
  pluginName: SLACK_INTEGRATION_NAME,
  executor: async ({ data, userId, workspaceId }) => {
    const api = makeAPI({ context: { workspaceId, userId } });
    const client = await makeClient({ api });

    const { channelName, isPrivate } = data;

    const createdChannel = await client.createChannel({
      name: channelName?.replaceAll(' ', '-').toLowerCase(),
      isPrivate: isPrivate === 'true' ? true : false,
    });

    if (createdChannel?.error) {
      throw new Error('Error creating channel');
    }

    const channelId = createdChannel?.channel?.id!;

    return {
      channelId,
    };
  },
  icon: {
    type: 'plugin',
    icon: slackIcon,
  },
  type: 'CREATE_NEW_CHANNEL',
  schema: CREATE_NEW_CHANNEL_SCHEMA,
  description: 'Create a new channel',
  label: 'Create New Channel',
  outputSchema: CREATE_NEW_CHANNEL_OUTPUT_SCHEMA,
});
