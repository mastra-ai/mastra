
import { Mastra } from '@mastra/core/mastra';
import { registerApiRoute } from '@mastra/core/server';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { slackWorkflow } from './workflows/slack-workflow';
import { slackAgent } from './agents/slack-agent';
import { slackSummaryTool } from './tools/slack-summary-tool';

export const mastra = new Mastra({
  workflows: { slackWorkflow },
  agents: { slackAgent },
  tools: { slackSummaryTool },
  server: {
    port: parseInt(process.env.PORT || '4112', 10),
    timeout: 30000,
    // Add health check endpoint for deployment monitoring
    apiRoutes: [
      registerApiRoute('/health', {
        method: 'GET',
        handler: async c => {
          return c.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            services: {
              agents: ['slackAgent'],
              workflows: ['slackWorkflow'],
              tools: ['slackSummaryTool'],
            },
          });
        },
      }),
      registerApiRoute('/slack/info', {
        method: 'GET',
        handler: async c => {
          return c.json({
            template: {
              name: 'Slack Message Search Summary',
              version: '1.0.0',
              description: 'Search and summarize Slack messages using MCP',
              capabilities: [
                'Message search via external MCP server',
                'AI-powered conversation summarization',
                'Thread analysis and filtering',
                'Action item extraction',
                'Decision tracking',
              ],
              availableTools: ['slackSummaryTool'],
              availableAgents: ['slackAgent'],
              availableWorkflows: ['slackWorkflow'],
            },
          });
        },
      }),
    ],
  },
  storage: new LibSQLStore({
    // stores telemetry, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: 'Mastra Slack Template',
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  }),
});
