import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import get from 'lodash/fp/get';
import { get as getFp } from 'lodash/fp';
import endOfDay from 'date-fns/endOfDay';

// This module is a tool entry that agents also import. With a top-level await, Rolldown moves it into a shared chunk
// named `tools`, which must not replace the `tools.mjs` manifest.
const description = await Promise.resolve('A tool that formats a date');

export const lodashTool = createTool({
  id: 'lodash',
  description,
  inputSchema: z.object({
    date: z.string(),
  }),
  execute: async context => {
    const x = getFp('date', context.data);
    return x || endOfDay(get('date', context.data));
  },
});
