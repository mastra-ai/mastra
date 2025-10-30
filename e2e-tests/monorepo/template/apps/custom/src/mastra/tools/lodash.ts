import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import get from 'lodash/fp/get';
import { get as getFp } from 'lodash/fp';
import endOfDay from 'date-fns/endOfDay';

export const lodashTool = createTool({
  id: 'lodash',
  description: 'A tool that formats a date',
  inputSchema: z.object({
    date: z.string(),
  }),
  execute: async context => {
    const x = getFp('date', context.data);
    return x || endOfDay(get('date', context.data));
  },
});
