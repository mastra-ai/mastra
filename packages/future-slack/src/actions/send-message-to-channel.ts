// @ts-ignore
// import slackIcon from '../assets/slack.svg';
import { DataLayer, IntegrationAction } from 'core';
import { z } from 'zod';

import { SEND_MESSAGE_TO_CHANNEL_SCHEMA } from '../schemas';
import { MakeClient } from '../types';

export const SEND_MESSAGE_TO_CHANNEL = ({
  name,
  dataAccess,
  makeClient,
}: {
  name: string;
  dataAccess: DataLayer;
  makeClient: MakeClient;
}): IntegrationAction<z.infer<typeof SEND_MESSAGE_TO_CHANNEL_SCHEMA>> => ({
  integrationName: name,
  executor: async ({ data, ctx: { referenceId } }) => {
    const client = await makeClient({ referenceId });

    const { channelId, message } = data;

    try {
      await client.joinChannel({ channelId });
    } catch (e) {
      console.log(e);
      // fail silently if the channel is already joined
    }

    await client.sendMessage({ channelId, message });
  },
  type: 'SEND_MESSAGE_TO_CHANNEL',
  schema: SEND_MESSAGE_TO_CHANNEL_SCHEMA,
  description: 'Send a message to a channel',
  icon: {
    icon: '',
    alt: 'Slack Icon',
  },
  async getSchemaOptions({ ctx }) {
    const channelsSet = new Set<any>();
    const client = await makeClient({ referenceId: ctx.referenceId });

    const channels = await client.getAllChannels();

    channels?.forEach(channel => {
      channelsSet.add(channel);
    });

    const schemaOptions = Array.from(channelsSet).map(channel => {
      return {
        label: `# ${channel.name}`,
        value: channel.id,
      };
    });

    return {
      channelId: { options: schemaOptions },
    };
  },
  label: 'Send Message to Channel',
});
