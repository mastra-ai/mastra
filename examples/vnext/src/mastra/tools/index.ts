import { createTool } from '@mastra/core';
import { z } from 'zod';

import { integrations } from '../integrations';

const testToolSchema = z.object({ name: z.string() });

export const testTool = createTool<typeof integrations, z.infer<typeof testToolSchema>>({
  label: 'Test Tool',
  schema: testToolSchema,
  description: `This is a test tool`,
  executor: async ({ data, getIntegration }) => {
    const integration = getIntegration('GITHUB');

    if (!integration) {
      throw new Error('Integration not found');
    }

    integration.executeTool('reposListForUser', {
      data: {
        body: {
          labels: ['test'],
        },
        path: {
          username: 'octocat',
        },
      },
    });

    return data;
  },
});
