import { createTool } from '@mastra/core';
import { z } from 'zod';

import { claude, github } from '../integrations';

export const testTool = createTool({
  id: 'Test Tool',
  inputSchema: z.object({ name: z.string(), message: z.string() }),
  description: `This is a test tool`,
  outputSchema: z.object({ message: z.string() }),
  execute: async () => {
    return {
      message: 'Hello',
    };
  },
});

export const testTool2 = createTool({
  id: 'Test Tool',
  inputSchema: z.object({
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
  id: 'Github Repos Tool',
  inputSchema: z.object({ username: z.string() }),
  description: `This is a tool to get all the repos for a user`,
  execute: async ({ context }) => {
    const GithubClient = await github.getApiClient();

    const repos = await GithubClient.reposListForUser({
      path: {
        username: context.username,
      },
    });

    return repos;
  },
});
