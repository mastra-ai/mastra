import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import YC_DATA from '../data/2024';

export const ycDirectoryTool = createTool({
  id: 'yc-directory',
  description: 'Get data from the 2024 YC directory',
  inputSchema: z.object({}),
  outputSchema: z.array(
    z.object({
      name: z.string(),
      longDescription: z.string(),
      tags: z.string(),
      industries: z.string(),
      batch: z.string(),
    }),
  ),
  execute: async ({ context }) => {
    return YC_DATA;
  },
});
