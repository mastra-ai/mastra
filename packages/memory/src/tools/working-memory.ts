import type { MemoryConfigInternal } from '@mastra/core/memory';
import { isStandardSchemaWithJSON, toStandardSchema } from '@mastra/core/schema';
import type { PublicSchema, StandardSchemaWithJSON } from '@mastra/core/schema';
import type { ToolAction } from '@mastra/core/tools';
import { createTool } from '@mastra/core/tools';
import { standardSchemaToJSONSchema } from '@mastra/schema-compat/schema';
import type { JSONSchema7 } from 'json-schema';

// Keep these in sync with @mastra/core/memory. @mastra/memory supports older
// peer-compatible @mastra/core versions that may not export the newer names.
const UPDATE_WORKING_MEMORY_TOOL_NAME = 'updateWorkingMemory';
const SET_WORKING_MEMORY_TOOL_NAME = 'setWorkingMemory';

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
  let inputSchema: PublicSchema<{ memory: any }> = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    properties: {
      memory: {
        type: 'string',
        description: `The Markdown formatted working memory content to store. This MUST be a string. Never pass an object.`,
      },
    },
    required: ['memory'],
  } satisfies JSONSchema7;

  if (schema) {
    // Convert the schema to StandardSchemaWithJSON first
    const standardSchema: StandardSchemaWithJSON = isStandardSchemaWithJSON(schema) ? schema : toStandardSchema(schema);

    // Get JSON schema using .input() since this describes the structure the tool should receive,
    // then wrap it for runtime validation of the tool's inputSchema
    const jsonSchema = standardSchemaToJSONSchema(standardSchema, { io: 'input' });
    delete jsonSchema.$schema;

    // Use the JSON Schema only to describe tool input to the model, and validate with
    // the schema's own (e.g. Zod-native) validator. Re-wrapping via toStandardSchema()
    // routed validation through AJV, which uses `new Function`/`eval` and crashes on
    // runtimes that forbid dynamic code generation such as Cloudflare Workers (#17301).
    const wrappedJsonSchema: JSONSchema7 = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      description: 'The JSON formatted working memory content to store.',
      properties: {
        memory: jsonSchema,
      },
      required: ['memory'],
    };

    // Validate the inner `memory` payload with the original schema's validator and
    // map a successful result back into the `{ memory }` shape the tool expects.
    const validateMemory = (memoryValue: unknown) => standardSchema['~standard'].validate(memoryValue);
    type ValidateResult = Awaited<ReturnType<typeof validateMemory>>;
    const toWrappedResult = (result: ValidateResult) =>
      'issues' in result && result.issues ? result : { value: { memory: result.value } };

    inputSchema = {
      '~standard': {
        version: 1,
        vendor: 'mastra',
        validate: (value: unknown) => {
          // Older models sometimes omit the top-level `memory` wrapper, so fall back to
          // stripping nulls from the raw value and validating it as the memory payload.
          const hasWrapper =
            !!value && typeof value === 'object' && !Array.isArray(value) && 'memory' in (value as object);
          const memoryValue = hasWrapper
            ? (value as { memory: unknown }).memory
            : stripNullsFromOptional(value, jsonSchema as Record<string, unknown>);

          const result = validateMemory(memoryValue);
          return result instanceof Promise ? result.then(toWrappedResult) : toWrappedResult(result);
        },
        jsonSchema: {
          input: () => wrappedJsonSchema,
          output: () => wrappedJsonSchema,
        },
      },
    } as unknown as StandardSchemaWithJSON<{ memory: any }>;
  }

  // For schema-based working memory, we use merge semantics
  // For template-based (Markdown), we use replace semantics (existing behavior)
  const usesMergeSemantics = Boolean(schema);

  const useStateSignals = memoryConfig?.workingMemory?.useStateSignals === true;

  const stateSignalsPreamble = `The current working memory state is delivered to you each turn by the system inside a <working-memory>...</working-memory> block. That block is system-emitted state, NOT something the user typed — never describe it as the user sharing it. Read from it directly when answering. Only call this tool when the user provides genuinely NEW or CHANGED facts that should be persisted; do NOT call it to re-save unchanged data.`;

  const description = schema
    ? useStateSignals
      ? `${stateSignalsPreamble} Data is merged with existing memory — only include fields you want to add or update.`
      : `Update the working memory with new information. Data is merged with existing memory - only include fields you want to add or update. To preserve existing data, omit the field entirely. Arrays are replaced entirely when provided, so pass the complete array or omit it to keep the existing values.`
    : useStateSignals
      ? `${stateSignalsPreamble} Pass the full updated Markdown blob as a string in the memory field.`
      : `Update the working memory with new information. Any data not included will be overwritten. Always pass data as string to the memory field. Never pass an object.`;

  return createTool({
    id: 'update-working-memory',
    description,
    inputSchema,
    execute: async (inputData, context) => {
      const workingMemoryInput = inputData as { memory: any };
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
        const memoryInput = workingMemoryInput.memory;
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
        const memoryInput = workingMemoryInput.memory;
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
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        newMemory: {
          type: 'string',
          description: `The ${config.workingMemory?.schema ? 'JSON' : 'Markdown'} formatted working memory content to store`,
        },
        searchString: {
          type: 'string',
          description:
            "The working memory string to find. Will be replaced with the newMemory string. If this is omitted or doesn't exist, the newMemory string will be appended to the end of your working memory. Replacing single lines at a time is encouraged for greater accuracy. If updateReason is not 'append-new-memory', this search string must be provided or the tool call will be rejected.",
        },
        updateReason: {
          type: 'string',
          enum: ['append-new-memory', 'clarify-existing-memory', 'replace-irrelevant-memory'],
          description:
            "The reason you're updating working memory. Passing any value other than 'append-new-memory' requires a searchString to be provided. Defaults to append-new-memory",
        },
      },
    } satisfies JSONSchema7,
    execute: async (inputData, context) => {
      const workingMemoryInput = inputData as {
        newMemory?: string;
        searchString?: string;
        updateReason?: 'append-new-memory' | 'clarify-existing-memory' | 'replace-irrelevant-memory';
      };
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

      const workingMemory = workingMemoryInput.newMemory || '';
      if (!workingMemoryInput.updateReason) workingMemoryInput.updateReason = `append-new-memory`;

      if (
        workingMemoryInput.searchString &&
        config.workingMemory?.scope === `resource` &&
        workingMemoryInput.updateReason === `replace-irrelevant-memory`
      ) {
        // don't allow replacements due to something not being relevant to the current conversation
        // if there's no searchString, then we will append.
        workingMemoryInput.searchString = undefined;
      }

      if (workingMemoryInput.updateReason === `append-new-memory` && workingMemoryInput.searchString) {
        // do not find/replace when append-new-memory is selected
        // some models get confused and pass a search string even when they don't want to replace it.
        // TODO: maybe they're trying to add new info after the search string?
        workingMemoryInput.searchString = undefined;
      }

      if (workingMemoryInput.updateReason !== `append-new-memory` && !workingMemoryInput.searchString) {
        return {
          success: false,
          reason: `updateReason was ${workingMemoryInput.updateReason} but no searchString was provided. Unable to replace undefined with "${workingMemoryInput.newMemory}"`,
        };
      }

      // Use the new updateWorkingMemory method which handles both thread and resource scope
      const result = await memory!.__experimental_updateWorkingMemoryVNext({
        threadId,
        resourceId,
        workingMemory: workingMemory,
        searchString: workingMemoryInput.searchString,
        memoryConfig: config,
      });

      if (result) {
        return result;
      }

      return { success: true };
    },
  });
};

/**
 * Returns the working-memory tool plus the wire name it should be registered under.
 *
 * - Default delivery (`useStateSignals: false`): wire name `updateWorkingMemory`,
 *   identical shape to today.
 * - State-signals delivery (`useStateSignals: true`): wire name `setWorkingMemory`.
 *   The rename keeps legacy strip filters (which match the literal `updateWorkingMemory`)
 *   from removing tool-call parts so they persist as a normal audit trail. Any
 *   future state-signal-specific tweaks to the tool (e.g. delta-aware results,
 *   scoped descriptions) belong here.
 *
 * The VNext vs default tool body decision is left to the caller because Memory
 * owns the `isVNextWorkingMemoryConfig` check; pass `vNext: true` to use the
 * search-and-replace shape.
 */
export function createWorkingMemoryTool(
  config: MemoryConfigInternal,
  options: { vNext?: boolean } = {},
): { name: string; tool: ToolAction<any, any, any> } {
  const useStateSignals = config.workingMemory?.useStateSignals === true;
  const tool = options.vNext ? __experimental_updateWorkingMemoryToolVNext(config) : updateWorkingMemoryTool(config);
  const name = useStateSignals ? SET_WORKING_MEMORY_TOOL_NAME : UPDATE_WORKING_MEMORY_TOOL_NAME;
  return { name, tool };
}
