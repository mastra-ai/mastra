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
    execute: async (input, context) => {
      // Support both agent context (nested) and direct execution (top-level)
      // Note: TypeScript types don't include top-level threadId/resourceId but they exist at runtime
      const threadId = context?.agent?.threadId ?? (context as any)?.threadId;
      const resourceId = context?.agent?.resourceId ?? (context as any)?.resourceId;

      // Memory can be accessed via context.mastra.memory OR directly via context.memory
      const memory = context?.mastra?.memory || (context as any)?.memory;

      if (!threadId || !memory || !resourceId) {
        throw new Error('Thread ID, Memory instance, and resourceId are required for working memory updates');
      }

      if (resourceId && resourceId !== resourceId) {
        throw new Error(`Thread with id ${threadId} resourceId does not match the current resourceId ${resourceId}`);
      }

      const workingMemory = typeof input.memory === 'string' ? input.memory : JSON.stringify(input.memory);

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
    execute: async (input, context) => {
      // Support both agent context (nested) and direct execution (top-level)
      // Note: TypeScript types don't include top-level threadId/resourceId but they exist at runtime
      const threadId = context?.agent?.threadId ?? (context as any)?.threadId;
      const resourceId = context?.agent?.resourceId ?? (context as any)?.resourceId;

      // Memory can be accessed via context.mastra.memory OR directly via context.memory
      const memory = context?.mastra?.memory || (context as any)?.memory;

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

      const workingMemory = input.newMemory || '';
      if (!input.updateReason) input.updateReason = `append-new-memory`;

      if (
        input.searchString &&
        config.workingMemory?.scope === `resource` &&
        input.updateReason === `replace-irrelevant-memory`
      ) {
        // don't allow replacements due to something not being relevant to the current conversation
        // if there's no searchString, then we will append.
        input.searchString = undefined;
      }

      if (input.updateReason === `append-new-memory` && input.searchString) {
        // do not find/replace when append-new-memory is selected
        // some models get confused and pass a search string even when they don't want to replace it.
        // TODO: maybe they're trying to add new info after the search string?
        input.searchString = undefined;
      }

      if (input.updateReason !== `append-new-memory` && !input.searchString) {
        return {
          success: false,
          reason: `updateReason was ${input.updateReason} but no searchString was provided. Unable to replace undefined with "${input.newMemory}"`,
        };
      }

      // Use the new updateWorkingMemory method which handles both thread and resource scope
      const result = await memory!.__experimental_updateWorkingMemoryVNext({
        threadId,
        resourceId,
        workingMemory: workingMemory,
        searchString: input.searchString,
        memoryConfig: config,
      });

      if (result) {
        return result;
      }

      return { success: true };
    },
  });
};
