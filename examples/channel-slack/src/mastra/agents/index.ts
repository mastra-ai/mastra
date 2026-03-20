import { Agent } from '@mastra/core/agent';
import type { ChannelContext } from '@mastra/core/channels';
import { LocalFilesystem, LocalSandbox, Workspace } from '@mastra/core/workspace';
import { DiscordAdapter } from '@chat-adapter/discord';
import { Memory } from '@mastra/memory';

export const exampleAgent = new Agent({
  id: 'example-agent',
  name: 'Example Agent',
  instructions: `You are a helpful assistant.`,
  model: 'openai/gpt-5.4',
  memory: new Memory({
    options: {
      observationalMemory: true,
    },
  }),
  channels: {
    discord: new DiscordAdapter({
      applicationId: process.env.DISCORD_APPLICATION_ID,
      publicKey: process.env.DISCORD_PUBLIC_KEY,
      botToken: process.env.DISCORD_BOT_TOKEN,
    }),
  },

  defaultOptions: {
    prepareStep: ({ messageList, requestContext }) => {
      const channel = requestContext?.get('channel') as ChannelContext | undefined;
      if (channel) {
        messageList.addSystem(
          `The user's name is ${channel.userName} (ID: ${channel.userId}). They're messaging via ${channel.platform}.`,
        );
      }
    },
  },

  workspace: new Workspace({
    id: 'example-workspace',
    filesystem: new LocalFilesystem({ basePath: './workspace' }),
    sandbox: new LocalSandbox({ workingDirectory: './workspace' }),
  }),
});
