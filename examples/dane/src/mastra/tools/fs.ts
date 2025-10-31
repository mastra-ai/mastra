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
  execute: async input => {
    try {
      switch (input.action) {
        case 'write':
          writeFileSync(input.file, input.data);
          break;
        case 'read':
          return { message: readFileSync(input.file, 'utf8') };
        case 'append':
          writeFileSync(input.file, input.data, { flag: 'a' });
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
