import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const NOT_CONFIGURED_MESSAGE = 'Slack is not configured for this project.';

/**
 * Server-side tool for the Agent Builder.
 *
 * When the user asks the builder to "connect this agent to Slack", the model
 * calls this tool. The tool asks Mastra's Slack `ChannelProvider` for a connect
 * URL and returns a plain-text message containing the link the user must click
 * to authorize the bot. No client-side redirect is performed.
 */
export const connectAgentToSlackTool = createTool({
  id: 'connect-agent-to-slack',
  description:
    'Generate a Slack connect link for an agent. Use this when the user asks to connect a specific agent to Slack. Returns a link the user must click to authorize the bot.',
  inputSchema: z.object({
    agentId: z
      .string()
      .min(1)
      .describe(
        'The id of the agent being edited (read from the form snapshot). The Slack bot will be wired to this agent.',
      ),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    url: z.string().optional(),
    error: z.string().optional(),
  }),
  execute: async (inputData, context) => {
    const { agentId } = inputData;
    const mastra = context?.mastra;

    if (!mastra) {
      return {
        success: false,
        message: 'Slack is not available in this environment.',
        error: 'mastra-missing',
      };
    }

    const slack = mastra.getChannelProvider('slack');

    if (!slack || typeof slack.connect !== 'function') {
      return {
        success: false,
        message: NOT_CONFIGURED_MESSAGE,
        error: 'slack-not-configured',
      };
    }

    const info = slack.getInfo?.();
    if (info && info.isConfigured === false) {
      return {
        success: false,
        message: NOT_CONFIGURED_MESSAGE,
        error: 'slack-not-configured',
      };
    }

    let result;
    try {
      result = await slack.connect(agentId);
    } catch (err) {
      return {
        success: false,
        message: 'Could not generate a Slack connect link.',
        error: err instanceof Error ? err.message : String(err),
      };
    }

    switch (result.type) {
      case 'oauth':
        return {
          success: true,
          message: `Follow this link to connect your agent to Slack: ${result.authorizationUrl}`,
          url: result.authorizationUrl,
        };
      case 'deep_link':
        return {
          success: true,
          message: `Follow this link to connect your agent to Slack: ${result.url}`,
          url: result.url,
        };
      case 'immediate':
        return {
          success: true,
          message: 'Your agent is now connected to Slack.',
        };
      default:
        return {
          success: false,
          message: 'Could not generate a Slack connect link.',
          error: 'unsupported-connect-result',
        };
    }
  },
});
