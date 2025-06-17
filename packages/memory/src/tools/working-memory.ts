import type { CoreTool } from '@mastra/core';
import type { WorkingMemoryFormat } from '@mastra/core/memory';
import { z } from 'zod';

export const updateWorkingMemoryTool = ({ format }: { format: WorkingMemoryFormat }): CoreTool => ({
  description: 'Update the working memory with new information',
  parameters: z.object({
    memory: z
      .string()
      .describe(`The ${format === 'json' ? 'JSON' : 'Markdown'} formatted working memory content to store`),
  }),
  execute: async (params: any) => {
    const { context, threadId, memory, resourceId } = params;
    if (!threadId || !memory) {
      throw new Error('Thread ID and Memory instance are required for working memory updates');
    }

    const thread = await memory.getThreadById({ threadId });

    if (!thread) {
      throw new Error(`Thread ${threadId} not found`);
    }

    if (thread.resourceId && thread.resourceId !== resourceId) {
      throw new Error(`Thread with id ${threadId} resourceId does not match the current resourceId ${resourceId}`);
    }

    const workingMemory = context.memory;

    // Update thread metadata with new working memory
    await memory.saveThread({
      thread: {
        ...thread,
        metadata: {
          ...thread.metadata,
          workingMemory: workingMemory,
        },
      },
    });

    return { success: true };
  },
});
