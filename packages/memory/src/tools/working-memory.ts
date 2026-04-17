import type { MemoryConfigInternal } from '@mastra/core/memory';
import { isStandardSchemaWithJSON, toStandardSchema } from '@mastra/core/schema';
import type { PublicSchema, StandardSchemaWithJSON } from '@mastra/core/schema';
import { createTool } from '@mastra/core/tools';
import { standardSchemaToJSONSchema } from '@mastra/schema-compat/schema';
import { z } from 'zod';

/**
 * Deep merges two objects, with special handling for null values (delete) and arrays (replace).
 * - Object properties are recursively merged
 * - null values in the update will delete the corresponding property
 * - Arrays are replaced entirely (not merged element-by-element)
 * - Primitive values are overwritten
 */
export function deepMergeWorkingMemory(
  existing: Record<string, unknown> | null | undefined,
  update: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  // Handle null/undefined/empty updates - preserve existing or return empty object
  if (!update || typeof update !== 'object' || Object.keys(update).length === 0) {
    return existing && typeof existing === 'object' ? { ...existing } : {};
  }

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

function stripNullsFromOptional(value: unknown, schema: Record<string, unknown>): unknown {
  if (Array.isArray(value)) {
    const itemSchema = (schema.items as Record<string, unknown>) ?? {};
    return value.map(item => stripNullsFromOptional(item, itemSchema));
  }

  if (typeof value === 'object' && value !== null) {
    const properties = (schema.properties as Record<string, Record<string, unknown>>) ?? {};
    const required = (schema.required as string[]) ?? [];
    const result: Record<string, unknown> = {};

    for (const [key, propertyValue] of Object.entries(value as Record<string, unknown>)) {
      if (propertyValue === null && !required.includes(key)) {
        continue;
      }

      result[key] = stripNullsFromOptional(propertyValue, properties[key] ?? {});
    }

    return result;
  }

  return value;
}

export const updateWorkingMemoryTool = (memoryConfig?: MemoryConfigInternal) => {
  const schema = memoryConfig?.workingMemory?.schema;

  // Default input schema for markdown-based working memory
  let inputSchema: PublicSchema<{ memory: any }> = z.object({
    memory: z
      .string()
      .describe(`The Markdown formatted working memory content to store. This MUST be a string. Never pass an object.`),
  });

  if (schema) {
    // Convert the schema to StandardSchemaWithJSON first
    const standardSchema: StandardSchemaWithJSON = isStandardSchemaWithJSON(schema) ? schema : toStandardSchema(schema);

    // Get JSON schema using .output() since this describes the structure the LLM should produce,
    // then convert to Zod for runtime validation of the tool's inputSchema
    const jsonSchema = standardSchemaToJSONSchema(standardSchema, { io: 'input' });
    delete jsonSchema.$schema;

    const wrappedSchema = toStandardSchema<{ memory: any }>({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      description: 'The JSON formatted working memory content to store.',
      properties: {
        memory: jsonSchema,
      },
      required: ['memory'],
    });

    inputSchema = {
      '~standard': {
        version: 1,
        vendor: 'mastra',
        validate: (value: unknown) => {
          const wrappedResult = wrappedSchema['~standard'].validate(value);

          if (wrappedResult instanceof Promise) {
            return wrappedResult.then(result => {
              if (!('issues' in result) || !result.issues) {
                return result;
              }

              if (!value || typeof value !== 'object' || Array.isArray(value) || 'memory' in value) {
                return result;
              }

              return wrappedSchema['~standard'].validate({
                memory: stripNullsFromOptional(value, jsonSchema as Record<string, unknown>),
              });
            });
          }

          if (!('issues' in wrappedResult) || !wrappedResult.issues) {
            return wrappedResult;
          }

          // Older models, especially AI SDK v4 / LanguageModel v1, sometimes return the
          // inner memory object without the required top-level `memory` wrapper.
          if (!value || typeof value !== 'object' || Array.isArray(value) || 'memory' in value) {
            return wrappedResult;
          }

          return wrappedSchema['~standard'].validate({
            memory: stripNullsFromOptional(value, jsonSchema as Record<string, unknown>),
          });
        },
        jsonSchema: {
          input: props => wrappedSchema['~standard'].jsonSchema.input(props),
          output: props => wrappedSchema['~standard'].jsonSchema.output(props),
        },
      },
    } as StandardSchemaWithJSON<{ memory: any }>;
  }

  // For schema-based working memory, we use merge semantics
  // For template-based (Markdown), we use replace semantics (existing behavior)
  const usesMergeSemantics = Boolean(schema);

  const description = schema
    ? `Update the working memory with new information. Data is merged with existing memory - only include fields you want to add or update. To preserve existing data, omit the field entirely. Arrays are replaced entirely when provided, so pass the complete array or omit it to keep the existing values.`
    : `Update the working memory with new information. Any data not included will be overwritten. Always pass data as string to the memory field. Never pass an object.`;

  return createTool({
    id: 'update-working-memory',
    description,
    inputSchema,
    execute: async (inputData: { memory: any }, context) => {
      const threadId = context?.agent?.threadId;
      const resourceId = context?.agent?.resourceId;

      // Memory can be accessed via context.memory (when agent is part of Mastra instance)
      // or context.memory (when agent is standalone with memory passed directly)
      const memory = (context as any)?.memory;

      if (!memory) {
        throw new Error('Memory instance is required for working memory updates');
      }

      const scope = memoryConfig?.workingMemory?.scope || 'resource';
      if (scope === 'thread' && !threadId) {
        throw new Error('Thread ID is required for thread-scoped working memory updates');
      }
      if (scope === 'resource' && !resourceId) {
        throw new Error('Resource ID is required for resource-scoped working memory updates');
      }

      if (threadId) {
        let thread = await memory.getThreadById({ threadId });

        if (!thread) {
          thread = await memory.createThread({
            threadId,
            resourceId,
            memoryConfig,
          });
        }

        if (thread.resourceId && resourceId && thread.resourceId !== resourceId) {
          throw new Error(`Thread with id ${threadId} resourceId does not match the current resourceId ${resourceId}`);
        }
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

        // Handle case where LLM passes empty object or no memory field
        const memoryInput = inputData.memory;
        if (memoryInput === undefined || memoryInput === null) {
          // No data to update - return existing data unchanged
          return { success: true, message: 'No memory data provided, existing memory unchanged.' };
        }

        let newData: unknown;
        if (typeof memoryInput === 'string') {
          try {
            newData = JSON.parse(memoryInput);
          } catch (parseError) {
            const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
            throw new Error(
              `Failed to parse working memory input as JSON: ${errorMessage}. ` +
                `Raw input: ${memoryInput.length > 500 ? memoryInput.slice(0, 500) + '...' : memoryInput}`,
            );
          }
        } else {
          newData = memoryInput;
        }

        const mergedData = deepMergeWorkingMemory(existingData, newData as Record<string, unknown>);
        workingMemory = JSON.stringify(mergedData);
      } else {
        // Template-based (Markdown): use existing replace semantics
        const memoryInput = inputData.memory;
        workingMemory = typeof memoryInput === 'string' ? memoryInput : JSON.stringify(memoryInput);

        // Validate that we're not replacing good data with an empty template
        // This prevents accidental data loss when the LLM returns just the template
        const existingRaw = await memory.getWorkingMemory({
          threadId,
          resourceId,
          memoryConfig,
        });

        if (existingRaw) {
          const template = await memory.getWorkingMemoryTemplate({ memoryConfig });
          if (template?.content) {
            // Normalize whitespace for comparison
            const normalizedNew = workingMemory.replace(/\s+/g, ' ').trim();
            const normalizedTemplate = template.content.replace(/\s+/g, ' ').trim();
            const normalizedExisting = existingRaw.replace(/\s+/g, ' ').trim();

            // If the new content is essentially the empty template and we have meaningful existing data
            if (normalizedNew === normalizedTemplate && normalizedExisting !== normalizedTemplate) {
              return {
                success: false,
                message:
                  'Attempted to replace existing working memory with empty template. Update skipped to prevent data loss.',
              };
            }
          }
        }
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

export const __experimental_updateWorkingMemoryToolVNext = (config: MemoryConfigInternal) => {
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
    execute: async (
      inputData: {
        newMemory?: string;
        searchString?: string;
        updateReason?: 'append-new-memory' | 'clarify-existing-memory' | 'replace-irrelevant-memory';
      },
      context,
    ) => {
      const threadId = context?.agent?.threadId;
      const resourceId = context?.agent?.resourceId;

      // Memory can be accessed via context.memory (when agent is part of Mastra instance)
      // or context.memory (when agent is standalone with memory passed directly)
      const memory = (context as any)?.memory;

      if (!memory) {
        throw new Error('Memory instance is required for working memory updates');
      }

      const scope = config.workingMemory?.scope || 'resource';
      if (scope === 'thread' && !threadId) {
        throw new Error('Thread ID is required for thread-scoped working memory updates');
      }
      if (scope === 'resource' && !resourceId) {
        throw new Error('Resource ID is required for resource-scoped working memory updates');
      }

      if (threadId) {
        let thread = await memory.getThreadById({ threadId });

        if (!thread) {
          thread = await memory.createThread({
            threadId,
            resourceId,
            memoryConfig: config,
          });
        }

        if (thread.resourceId && resourceId && thread.resourceId !== resourceId) {
          throw new Error(`Thread with id ${threadId} resourceId does not match the current resourceId ${resourceId}`);
        }
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
