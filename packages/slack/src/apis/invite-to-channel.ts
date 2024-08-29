import { DataLayer, IntegrationApi } from '@arkw/core';
import { z } from 'zod';

//@ts-ignore
import slackIcon from '../assets/slack.svg';
import { INVITE_TO_CHANNEL_SCHEMA } from '../schemas';
import { MakeClient } from '../types';

export const INVITE_TO_CHANNEL = ({
  name,
  makeClient,
}: {
  name: string;
  dataAccess: DataLayer;
  makeClient: MakeClient;
}): IntegrationApi<z.infer<typeof INVITE_TO_CHANNEL_SCHEMA>> => ({
  integrationName: name,
  executor: async ({ data, ctx: { referenceId } }) => {
    const client = await makeClient({ referenceId });

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
    alt: 'Slack Icon',
  },
  async getSchemaOptions({ ctx }) {
    const usersSet = new Set<any>();

    const client = await makeClient({ referenceId: ctx.referenceId });

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
