import type { CoreTool } from '@mastra/core';
import type { ToolExecutionOptions } from 'ai';
import { z } from 'zod';

export const updateWorkingMemoryTool: CoreTool = {
  description: 'Update the working memory with new information',
  parameters: z.object({
    memory: z.string().describe('The XML-formatted working memory content to store'),
  }),
  execute: async (params: any, _options: ToolExecutionOptions) => {
    const { context, threadId, memory } = params;
    if (!threadId || !memory) {
      throw new Error('Thread ID and Memory instance are required for working memory updates');
    }

    const thread = await memory.getThreadById({ threadId });
    if (!thread) {
      throw new Error(`Thread ${threadId} not found`);
    }

    // Update thread metadata with new working memory
    await memory.saveThread({
      thread: {
        ...thread,
        metadata: {
          ...thread.metadata,
          workingMemory: context.memory,
        },
      },
    });

    return { success: true };
  },
};
