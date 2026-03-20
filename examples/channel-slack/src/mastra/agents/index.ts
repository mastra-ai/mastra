import { Agent } from '@mastra/core/agent';
import { ChatAdapterChannel } from '@mastra/channel-chat-adapter';
import { DiscordAdapter } from '@chat-adapter/discord';
import { Memory } from '@mastra/memory';
import { ChannelContext } from '@mastra/core/channels';
import { LocalFilesystem, LocalSandbox, Workspace } from '@mastra/core/workspace';

export const exampleAgent = new Agent({
  id: 'example-agent',
  name: 'Example Agent',
  instructions: `You are a helpful assistant.
Keep your responses concise and conversational. If you're writing a long message it is better to split it up into multiple smaller messages since the user can't see it until you finish writing it, unlike other UIs that show it streamed in real time.`,
  model: 'openai/gpt-5.4',
  memory: new Memory({
    options: {
      observationalMemory: true,
    },
  }),
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
  channels: {
    discord: new ChatAdapterChannel({
      adapter: new DiscordAdapter({
        applicationId: process.env.DISCORD_APPLICATION_ID,
        publicKey: process.env.DISCORD_PUBLIC_KEY,
        botToken: process.env.DISCORD_BOT_TOKEN,
      }),
    }),
  },
  workspace: new Workspace({
    id: 'example-workspace',
    filesystem: new LocalFilesystem({ basePath: './workspace' }),
    sandbox: new LocalSandbox({ workingDirectory: './workspace' }),
  }),
});
