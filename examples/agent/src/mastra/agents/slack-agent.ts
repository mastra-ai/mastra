import { Agent } from '@mastra/core/agent';
import { LocalFilesystem, LocalSandbox, Workspace } from '@mastra/core/workspace';
import { Memory } from '@mastra/memory';

/**
 * A demo agent for Slack integration.
 *
 * The `channels.slack` config is read by SlackChannel when this agent
 * is registered with Mastra.
 *
 * Use `slack: true` for defaults, or provide a config object for customization:
 * - iconUrl: Custom bot avatar (uploaded via undocumented Slack API)
 * - slashCommands: Register slash commands with prompt templates
 * - additionalScopes: Extra OAuth scopes beyond defaults
 * - additionalEvents: Extra event subscriptions beyond defaults
 */
export const slackDemoAgent = new Agent({
  id: 'slack-demo-agent',
  name: 'Slack Demo Agent',
  instructions: `You are a helpful assistant available in Slack.
Keep your responses concise and formatted for Slack (use *bold*, _italic_, \`code\`, etc).`,
  model: 'openai/gpt-5.4',
  channels: { slack: true },
  memory: new Memory({
    options: {
      observationalMemory: true,
    },
  }),
  workspace: new Workspace({
    filesystem: new LocalFilesystem({
      basePath: './workspace',
    }),
    sandbox: new LocalSandbox({
      workingDirectory: './workspace',
    }),
  }),
});
