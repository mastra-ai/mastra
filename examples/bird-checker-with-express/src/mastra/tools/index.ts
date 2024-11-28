import { createTool } from '@mastra/core';
import { z } from 'zod';

import { getRandomImage } from '../../lib/utils';

export const getRandomImageTool = createTool({
  label: 'Get a random image from unsplash',
  description: 'Gets a random image from unsplash based on the selected option',
  schema: z.object({
    query: z.enum(['wildlife', 'feathers', 'flying', 'birds']),
  }),
  executor: async ({ data }) => {
    return getRandomImage(data);
  },
});
