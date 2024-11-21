import { createTool } from '@mastra/core';
import { z } from 'zod';

import { integrations } from '../integrations';

const testToolSchema = z.object({ name: z.string(), message: z.string() });

export const testTool = createTool({
  label: 'Test Tool',
  schema: testToolSchema,
  description: `This is a test tool`,
  executor: async ({ data, getIntegration, agents, engine, llm }) => {
    const integration = getIntegration<typeof integrations>('GITHUB');

    if (!integration) {
      throw new Error('Integration not found');
    }

    return data;
  },
});
