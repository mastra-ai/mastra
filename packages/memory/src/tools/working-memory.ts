import type { MemoryConfig } from '@mastra/core/memory';
import { createTool } from '@mastra/core/tools';
import { convertSchemaToZod } from '@mastra/schema-compat';
import type { Schema } from 'ai';
import { z, ZodObject } from 'zod';
import type { ZodType } from 'zod';

export const updateWorkingMemoryTool = (memoryConfig?: MemoryConfig) => {
  const schema = memoryConfig?.workingMemory?.schema;

  let inputSchema: ZodType = z.object({
    memory: z
      .string()
      .describe(`The Markdown formatted working memory content to store. This MUST be a string. Never pass an object.`),
  });

  if (schema) {
    inputSchema = z.object({
      memory:
        schema instanceof ZodObject
          ? schema
          : (convertSchemaToZod({ jsonSchema: schema } as Schema).describe(
              `The JSON formatted working memory content to store.`,
            ) as ZodObject<any>),
    });
  }

  return createTool({
    id: 'update-working-memory',
    description: `Update the working memory with new information. Any data not included will be overwritten.${schema ? ' Always pass data as string to the memory field. Never pass an object.' : ''}`,
    inputSchema,
    execute: async params => {
      const { context, threadId, memory, resourceId } = params;
      if (!threadId || !memory || !resourceId) {
        throw new Error('Thread ID, Memory instance, and resourceId are required for working memory updates');
      }

      let thread = await memory.getThreadById({ threadId });

      if (!thread) {
        thread = await memory.createThread({
          threadId,
          resourceId,
          memoryConfig,
        });
      }

      if (thread.resourceId && thread.resourceId !== resourceId) {
        throw new Error(`Thread with id ${threadId} resourceId does not match the current resourceId ${resourceId}`);
      }

      const workingMemory = typeof context.memory === 'string' ? context.memory : JSON.stringify(context.memory);

      // Use the new updateWorkingMemory method which handles both thread and resource scope
      await memory.updateWorkingMemory({
        threadId,
        resourceId,
        workingMemory,
        memoryConfig,
      });

      return { success: true };
    },
  });
};

export const __experimental_updateWorkingMemoryToolVNext = (config: MemoryConfig) => {
  return createTool({
    id: 'update-working-memory',
    description: 'Update the working memory with new information.',
    inputSchema: z.object({
      newMemory: z
        .string()
        .optional()
        .describe(
          `The ${config.workingMemory?.schema ? 'JSON' : 'Markdown'} formatted working memory content to store`,
        ),
      searchString: z
        .string()
        .optional()
        .describe(
          "The working memory string to find. Will be replaced with the newMemory string. If this is omitted or doesn't exist, the newMemory string will be appended to the end of your working memory. Replacing single lines at a time is encouraged for greater accuracy. If updateReason is not 'append-new-memory', this search string must be provided or the tool call will be rejected.",
        ),
      updateReason: z
        .enum(['append-new-memory', 'clarify-existing-memory', 'replace-irrelevant-memory'])
        .optional()
        .describe(
          "The reason you're updating working memory. Passing any value other than 'append-new-memory' requires a searchString to be provided. Defaults to append-new-memory",
        ),
    }),
    execute: async params => {
      const { context, threadId, memory, resourceId } = params;
      if (!threadId || !memory || !resourceId) {
        throw new Error('Thread ID, Memory instance, and resourceId are required for working memory updates');
      }

      let thread = await memory.getThreadById({ threadId });

      if (!thread) {
        thread = await memory.createThread({
          threadId,
          resourceId,
          memoryConfig: config,
        });
      }

      if (thread.resourceId && thread.resourceId !== resourceId) {
        throw new Error(`Thread with id ${threadId} resourceId does not match the current resourceId ${resourceId}`);
      }

      const workingMemory = context.newMemory || '';
      if (!context.updateReason) context.updateReason = `append-new-memory`;

      if (
        context.searchString &&
        config.workingMemory?.scope === `resource` &&
        context.updateReason === `replace-irrelevant-memory`
      ) {
        // don't allow replacements due to something not being relevant to the current conversation
        // if there's no searchString, then we will append.
        context.searchString = undefined;
      }

      if (context.updateReason === `append-new-memory` && context.searchString) {
        // do not find/replace when append-new-memory is selected
        // some models get confused and pass a search string even when they don't want to replace it.
        // TODO: maybe they're trying to add new info after the search string?
        context.searchString = undefined;
      }

      if (context.updateReason !== `append-new-memory` && !context.searchString) {
        return {
          success: false,
          reason: `updateReason was ${context.updateReason} but no searchString was provided. Unable to replace undefined with "${context.newMemory}"`,
        };
      }

      // Use the new updateWorkingMemory method which handles both thread and resource scope
      const result = await memory.__experimental_updateWorkingMemoryVNext({
        threadId,
        resourceId,
        workingMemory: workingMemory,
        searchString: context.searchString,
        memoryConfig: config,
      });

      if (result) {
        return result;
      }

      return { success: true };
    },
  });
};
