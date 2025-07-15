import type { CoreTool, MemoryConfig } from '@mastra/core';
import { z } from 'zod';

export const updateWorkingMemoryTool = (memoryConfig?: MemoryConfig): CoreTool => ({
  description:
    'Update the working memory with new information. Always pass data as string to the memory field. Never pass an object.',
  parameters: z.object({
    memory: z
      .string()
      .describe(
        `The ${!!memoryConfig?.workingMemory?.schema ? 'JSON' : 'Markdown'} formatted working memory content to store. This MUST be a string. Never pass an object.`,
      ),
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

    // Use the new updateWorkingMemory method which handles both thread and resource scope
    await memory.updateWorkingMemory({
      threadId,
      resourceId: resourceId || thread.resourceId,
      workingMemory: workingMemory,
      memoryConfig,
    });

    return { success: true };
  },
});
