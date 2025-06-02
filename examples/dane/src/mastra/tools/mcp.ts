import { MCPClient } from '@mastra/mcp';

export const slack = new MCPClient({
  servers: {
    slack: {
      command: '/usr/local/bin/docker',
      args: ['run', '-i', '--rm', '-e', 'SLACK_BOT_TOKEN', '-e', 'SLACK_TEAM_ID', 'mcp/slack'],
      env: {
        SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN!,
        SLACK_TEAM_ID: process.env.SLACK_TEAM_ID!,
      },
    },
  },
});
