// Test with real imports
import { z } from 'zod';
import { createTool } from './src/tools/tool';

const tool = createTool({
  id: 'test',
  description: 'test',
  inputSchema: z.object({ 
    message: z.string(),
    count: z.number()
  }),
  outputSchema: z.object({ 
    result: z.string()
  }),
  execute: async ({ context }) => {
    // These should be properly typed
    const message: string = context.message;
    const count: number = context.count;
    
    return { 
      result: `${message} - ${count}`
    };
  },
});

export { tool };