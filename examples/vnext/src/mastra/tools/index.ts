import { createTool } from '@mastra/core';
import { z } from 'zod';

import { claude, github } from '../integrations';

export const testTool = createTool({
  label: 'Test Tool',
  schema: z.object({ name: z.string(), message: z.string() }),
  description: `This is a test tool`,
  outputSchema: z.object({ message: z.string() }),
  execute: async () => {
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
  execute: async () => {
    console.log(await claude.getApiClient());
    return {
      message: 'Hello',
    };
  },
});

export const GithubReposTool = createTool({
  label: 'Github Repos Tool',
  schema: z.object({ username: z.string() }),
  description: `This is a tool to get all the repos for a user`,
  execute: async ({ data }) => {
    const GithubClient = await github.getApiClient();

    const repos = await GithubClient.reposListForUser({
      path: {
        username: data.username,
      },
    });

    return repos;
  },
});
