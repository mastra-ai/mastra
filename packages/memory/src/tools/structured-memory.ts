import type { CoreTool } from '@mastra/core/tools';
import { z, ZodObject } from 'zod';

export const updateStructuredMemoryTool = ({ schema }: { schema: ZodObject<any> }): CoreTool => {
  return {
    description: 'Update the structured memory with new data',
    parameters: z.object({
      memory: z.string().describe('The JSON-formatted structured memory content to store'),
      schema: schema,
    }),
    execute: async (params: any) => {
      const { context, threadId, memory } = params;

      if (!threadId || !memory) {
        throw new Error('Thread ID and Memory instance are required for working memory updates');
      }

      const thread = await memory.getThreadById({ threadId });

      if (!thread) {
        throw new Error(`Thread ${threadId} not found`);
      }

      const threadToSave = {
        ...thread,
        metadata: {
          ...thread.metadata,
          workingMemory: context.memory,
          json: context.schema,
        },
      };

      // Update thread metadata with new working memory
      await memory.saveThread({
        thread: threadToSave,
      });

      return { success: true };
    },
  };
};
