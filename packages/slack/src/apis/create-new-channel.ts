// @ts-ignore
// import slackIcon from '../assets/slack.svg';
import { DataLayer, IntegrationApi } from '@arkw/core';
import { z } from 'zod';

// @ts-ignore
import slackIcon from '../assets/slack.svg';
import { CREATE_NEW_CHANNEL_SCHEMA, CREATE_NEW_CHANNEL_OUTPUT_SCHEMA } from '../schemas';
import { MakeClient } from '../types';

export const CREATE_NEW_CHANNEL = ({
  name,
  makeClient,
}: {
  name: string;
  dataAccess: DataLayer;
  makeClient: MakeClient;
}): IntegrationApi<z.infer<typeof CREATE_NEW_CHANNEL_SCHEMA>, z.infer<typeof CREATE_NEW_CHANNEL_OUTPUT_SCHEMA>> => ({
  integrationName: name,
  executor: async ({ data, ctx: { referenceId } }) => {
    const client = await makeClient({ referenceId });

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
    alt: 'Slack Icon',
    icon: slackIcon,
  },
  type: 'CREATE_NEW_CHANNEL',
  schema: CREATE_NEW_CHANNEL_SCHEMA,
  description: 'Create a new channel',
  label: 'Create New Channel',
  outputSchema: CREATE_NEW_CHANNEL_OUTPUT_SCHEMA,
});
