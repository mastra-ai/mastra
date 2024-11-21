import { createTool } from '@mastra/core';
import { z } from 'zod';

import { integrations } from '../integrations';

export const testTool = createTool({
  label: 'Test Tool',
  schema: z.object({ name: z.string(), message: z.string() }),
  description: `This is a test tool`,
  executor: async ({ data, mastraIntegrations, agents, engine, llm }) => {
    const GithubIntegration = mastraIntegrations<typeof integrations>().get('GITHUB');

    return data;
  },
});

export const testTool2 = createTool({
  label: 'Test Tool',
  schema: z.object({
    balance: z.number(),
  }),
  description: `This is a test tool`,
  executor: async ({ data, mastraIntegrations, agents, engine, llm }) => {
    const ClaudeIntegration = mastraIntegrations<typeof integrations>().get('CLAUDE');

    return data;
  },
});
