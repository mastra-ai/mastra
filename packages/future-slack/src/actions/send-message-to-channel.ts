import { z } from 'zod';

import { IntegrationAction, MakeAPI } from '../../types';
import slackIcon from '../assets/slack.svg';
import { SLACK_INTEGRATION_NAME } from '../constants';
import { SEND_MESSAGE_TO_CHANNEL_SCHEMA } from '../schemas';
import { MakeClient } from '../types';

export const SEND_MESSAGE_TO_CHANNEL = ({
  makeAPI,
  makeClient,
}: {
  makeAPI: MakeAPI;
  makeClient: MakeClient;
}): IntegrationAction<z.infer<typeof SEND_MESSAGE_TO_CHANNEL_SCHEMA>> => ({
  pluginName: SLACK_INTEGRATION_NAME,
  executor: async ({ data, userId, workspaceId }) => {
    const api = makeAPI({ context: { workspaceId, userId } });
    const client = await makeClient({ api });

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
    icon: slackIcon,
    type: 'plugin',
  },
  async getSchemaOptions({ ctx }) {
    const channelsSet = new Set<any>();
    const api = makeAPI({ context: ctx });
    const client = await makeClient({ api });

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
