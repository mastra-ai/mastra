import { Agent } from '@mastra/core/agent';
import { ChatChannelProcessor } from '@mastra/core/channels';
import { LocalFilesystem, LocalSandbox, Workspace } from '@mastra/core/workspace';
import { DiscordAdapter } from '@chat-adapter/discord';
import { SlackAdapter } from '@chat-adapter/slack';
import { Memory } from '@mastra/memory';
import { ConsoleLogger } from '@mastra/core/logger';

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
      logger: new ConsoleLogger({ name: 'DiscordAdapter', level: 'debug', component: 'CHANNEL' }),
    }),
    slack: new SlackAdapter({
      clientId: process.env.SLACK_CLIENT_ID!,
      clientSecret: process.env.SLACK_CLIENT_SECRET!,
      signingSecret: process.env.SLACK_SIGNING_SECRET!,
      botToken: process.env.SLACK_BOT_TOKEN!,
      logger: new ConsoleLogger({ name: 'SlackAdapter', level: 'debug', component: 'CHANNEL' }),
    }),
  },
  inputProcessors: [new ChatChannelProcessor()],
  workspace: new Workspace({
    id: 'example-workspace',
    filesystem: new LocalFilesystem({ basePath: './workspace' }),
    sandbox: new LocalSandbox({ workingDirectory: './workspace' }),
    tools: {
      // requireApproval: true,
      mastra_workspace_list_files: {
        name: 'list_files',
      },
      mastra_workspace_delete: {
        name: 'delete',
      },
      mastra_workspace_read_file: {
        name: 'view',
      },
      mastra_workspace_edit_file: {
        name: 'edit',
      },
      mastra_workspace_write_file: {
        name: 'write_file',
      },
      mastra_workspace_file_stat: {
        name: 'file_stat',
      },
      mastra_workspace_mkdir: {
        name: 'mkdir',
      },
      mastra_workspace_grep: {
        name: 'grep',
      },
      mastra_workspace_ast_edit: {
        name: 'ast_edit',
      },
      mastra_workspace_execute_command: {
        name: 'execute_command',
      },
      mastra_workspace_get_process_output: {
        name: 'get_process_output',
      },
      mastra_workspace_kill_process: {
        name: 'kill_process',
      },
    },
  }),
});
