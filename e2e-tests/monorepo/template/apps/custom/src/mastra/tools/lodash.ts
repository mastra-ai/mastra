import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import get from 'lodash/fp/get';

export const lodashTool = createTool({
  id: 'lodash',
  description: 'A tool that formats a date',
  inputSchema: z.object({
    date: z.string(),
  }),
  execute: async context => {
    return get('date', context.data);
  },
});
