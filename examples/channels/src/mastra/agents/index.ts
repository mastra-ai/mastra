import { Agent } from '@mastra/core/agent';
import { ChatChannelProcessor } from '@mastra/core/channels';
import { LocalFilesystem, LocalSandbox, Workspace } from '@mastra/core/workspace';
import { DiscordAdapter } from '@chat-adapter/discord';
import { SlackAdapter } from '@chat-adapter/slack';
import { TelegramAdapter } from '@chat-adapter/telegram';
import { Memory } from '@mastra/memory';

export const exampleAgent = new Agent({
  id: 'example-agent',
  name: 'Example Agent',
  instructions: `You are a helpful assistant. If the user only asks you to run a tool and nothing else, you don't need to repeat the tool call output if you have nothing else to add since the tool call result is already shown to the user right after its called.`,
  model: 'openai/gpt-5.4',
  memory: new Memory({
    options: {
      observationalMemory: true,
    },
  }),
  channels: {
    discord: {
      adapter: new DiscordAdapter(),
      // formatError: () => 'Something went wrong. Please try again later.',
    },
    slack: new SlackAdapter(),
    telegram: new TelegramAdapter(),
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
