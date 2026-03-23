import { Agent } from '@mastra/core/agent';
import { ChatChannelProcessor, type ChannelContext } from '@mastra/core/channels';
import { LocalFilesystem, LocalSandbox, Workspace } from '@mastra/core/workspace';
import { DiscordAdapter, createDiscordAdapter } from '@chat-adapter/discord';
import { createSlackAdapter, SlackAdapter } from '@chat-adapter/slack';
import { Memory } from '@mastra/memory';
import { AgentChat } from '@mastra/core/channels';

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
    slack: new SlackAdapter({
      clientId: process.env.SLACK_CLIENT_ID!,
      clientSecret: process.env.SLACK_CLIENT_SECRET!,
      signingSecret: process.env.SLACK_SIGNING_SECRET!,
      botToken: process.env.SLACK_BOT_TOKEN!,
    }),
  },
  inputProcessors: [new ChatChannelProcessor()],
  workspace: new Workspace({
    id: 'example-workspace',
    filesystem: new LocalFilesystem({ basePath: './workspace' }),
    sandbox: new LocalSandbox({ workingDirectory: './workspace' }),
  }),
});
