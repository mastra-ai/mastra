import { createTool } from '@mastra/core/tools';
import { readFileSync, writeFileSync } from 'fs';
import { z } from 'zod';

export const fsTool = createTool({
  id: 'fsTool',
  description: 'File System Tool',
  inputSchema: z.object({
    action: z.string(),
    file: z.string(),
    data: z.string(),
  }),
  outputSchema: z.object({
    message: z.string(),
  }),
  execute: async ({ context: { action, file, data } }) => {
    try {
      switch (action) {
        case 'write':
          writeFileSync(file, data);
          break;
        case 'read':
          return { message: readFileSync(file, 'utf8') };
        case 'append':
          writeFileSync(file, data, { flag: 'a' });
          break;
        default:
          return { message: 'Invalid action' };
      }
      return { message: 'Success' };
    } catch (e) {
      return { message: 'Error' };
    }
  },
});
