import { createTool } from '@mastra/core';
import { z } from 'zod';

import { integrations } from '../integrations';

export const testTool = createTool({
  label: 'Test Tool',
  schema: z.object({ name: z.string(), message: z.string() }),
  description: `This is a test tool`,
  outputSchema: z.object({ message: z.string() }),
  executor: async ({ data, integrationsRegistry, agents, engine, llm }) => {
    const GithubIntegration = integrationsRegistry<typeof integrations>().get('GITHUB');

    return {
      message: 'Hello',
    };
  },
});

export const testTool2 = createTool({
  label: 'Test Tool',
  schema: z.object({
    balance: z.number(),
  }),
  outputSchema: z.object({
    message: z.string(),
  }),
  description: `This is a test tool`,
  executor: async ({ data, integrationsRegistry, agents, engine, llm }) => {
    const ClaudeIntegration = integrationsRegistry<typeof integrations>().get('CLAUDE');

    return {
      message: 'Hello',
    };
  },
});

export const GithubReposTool = createTool({
  label: 'Github Repos Tool',
  schema: z.object({ username: z.string() }),
  description: `This is a tool to get all the repos for a user`,
  executor: async ({ data, integrationsRegistry, agents, engine, llm }) => {
    const GithubIntegration = integrationsRegistry<typeof integrations>().get('GITHUB');

    const GithubClient = await GithubIntegration.getApiClient();

    const repos = await GithubClient.reposListForUser({
      path: {
        username: data.username,
      },
    });

    return repos;
  },
});
