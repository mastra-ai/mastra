import type { MemoryConfig } from '@mastra/core/memory';
import { createTool } from '@mastra/core/tools';
import { convertSchemaToZod } from '@mastra/schema-compat';
import type { Schema } from '@mastra/schema-compat';
import { z, ZodObject } from 'zod';
import type { ZodType } from 'zod';

/**
 * Deep merges two objects, with special handling for null values (delete) and arrays (replace).
 * - Object properties are recursively merged
 * - null values in the update will delete the corresponding property
 * - Arrays are replaced entirely (not merged element-by-element)
 * - Primitive values are overwritten
 */
export function deepMergeWorkingMemory(
  existing: Record<string, unknown> | null | undefined,
  update: Record<string, unknown>,
): Record<string, unknown> {
  if (!existing || typeof existing !== 'object') {
    return update;
  }

  const result: Record<string, unknown> = { ...existing };

  for (const key of Object.keys(update)) {
    const updateValue = update[key];
    const existingValue = result[key];

    // null means delete the property
    if (updateValue === null) {
      delete result[key];
    }
    // Arrays are replaced entirely (too complex to diff/merge arrays of objects)
    else if (Array.isArray(updateValue)) {
      result[key] = updateValue;
    }
    // Recursively merge nested objects
    else if (
      typeof updateValue === 'object' &&
      updateValue !== null &&
      typeof existingValue === 'object' &&
      existingValue !== null &&
      !Array.isArray(existingValue)
    ) {
      result[key] = deepMergeWorkingMemory(
        existingValue as Record<string, unknown>,
        updateValue as Record<string, unknown>,
      );
    }
    // Primitive values or new properties: just set them
    else {
      result[key] = updateValue;
    }
  }

  return result;
}

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

  // For schema-based working memory, we use merge semantics
  // For template-based (Markdown), we use replace semantics (existing behavior)
  const usesMergeSemantics = Boolean(schema);

  const description = schema
    ? `Update the working memory with new information. Data is merged with existing memory - you only need to include fields you want to add or update. Set a field to null to remove it. Arrays are replaced entirely when provided.`
    : `Update the working memory with new information. Any data not included will be overwritten. Always pass data as string to the memory field. Never pass an object.`;

  return createTool({
    id: 'update-working-memory',
    description,
    inputSchema,
    execute: async (inputData, context) => {
      const threadId = context?.agent?.threadId;
      const resourceId = context?.agent?.resourceId;

      // Memory can be accessed via context.memory (when agent is part of Mastra instance)
      // or context.memory (when agent is standalone with memory passed directly)
      const memory = (context as any)?.memory;

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

      let workingMemory: string;

      if (usesMergeSemantics) {
        // Schema-based: fetch existing, merge, save
        const existingRaw = await memory.getWorkingMemory({
          threadId,
          resourceId,
          memoryConfig,
        });

        let existingData: Record<string, unknown> | null = null;
        if (existingRaw) {
          try {
            existingData = typeof existingRaw === 'string' ? JSON.parse(existingRaw) : existingRaw;
          } catch {
            // If existing data is not valid JSON, start fresh
            existingData = null;
          }
        }

        let newData: unknown;
        if (typeof inputData.memory === 'string') {
          try {
            newData = JSON.parse(inputData.memory);
          } catch (parseError) {
            const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
            throw new Error(
              `Failed to parse working memory input as JSON: ${errorMessage}. ` +
                `Raw input: ${inputData.memory.length > 500 ? inputData.memory.slice(0, 500) + '...' : inputData.memory}`,
            );
          }
        } else {
          newData = inputData.memory;
        }

        const mergedData = deepMergeWorkingMemory(existingData, newData as Record<string, unknown>);
        workingMemory = JSON.stringify(mergedData);
      } else {
        // Template-based (Markdown): use existing replace semantics
        workingMemory = typeof inputData.memory === 'string' ? inputData.memory : JSON.stringify(inputData.memory);
      }

      // Use the updateWorkingMemory method which handles both thread and resource scope
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
    execute: async (inputData, context) => {
      const threadId = context?.agent?.threadId;
      const resourceId = context?.agent?.resourceId;

      // Memory can be accessed via context.memory (when agent is part of Mastra instance)
      // or context.memory (when agent is standalone with memory passed directly)
      const memory = (context as any)?.memory;

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

      const workingMemory = inputData.newMemory || '';
      if (!inputData.updateReason) inputData.updateReason = `append-new-memory`;

      if (
        inputData.searchString &&
        config.workingMemory?.scope === `resource` &&
        inputData.updateReason === `replace-irrelevant-memory`
      ) {
        // don't allow replacements due to something not being relevant to the current conversation
        // if there's no searchString, then we will append.
        inputData.searchString = undefined;
      }

      if (inputData.updateReason === `append-new-memory` && inputData.searchString) {
        // do not find/replace when append-new-memory is selected
        // some models get confused and pass a search string even when they don't want to replace it.
        // TODO: maybe they're trying to add new info after the search string?
        inputData.searchString = undefined;
      }

      if (inputData.updateReason !== `append-new-memory` && !inputData.searchString) {
        return {
          success: false,
          reason: `updateReason was ${inputData.updateReason} but no searchString was provided. Unable to replace undefined with "${inputData.newMemory}"`,
        };
      }

      // Use the new updateWorkingMemory method which handles both thread and resource scope
      const result = await memory!.__experimental_updateWorkingMemoryVNext({
        threadId,
        resourceId,
        workingMemory: workingMemory,
        searchString: inputData.searchString,
        memoryConfig: config,
      });

      if (result) {
        return result;
      }

      return { success: true };
    },
  });
};
