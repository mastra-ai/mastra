import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MockMemory } from '../../memory/mock';
import { WorkingMemory } from '../../processors/memory/working-memory';
import { Agent } from '../agent';

/**
 * Tests that document and verify bugs in Working Memory data integrity and initialization.
 *
 * Related: https://github.com/mastra-ai/mastra/issues/13990
 *
 * Bug 1: generateEmptyFromSchema fails on string schemas, nested objects, and defaults
 * Bug 2: Thread metadata is overwritten instead of merged
 * Bug 3: Working Memory does not support partial JSON updates
 * Bug 4: <working_memory_data> is empty when no data exists yet
 * Bug 5: updateWorkingMemory tool description instructs LLM to send entire content
 */

// Helper: create a dummy model that returns a fixed response
function createDummyModel(responseText = 'Dummy response') {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop' as const,
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      text: responseText,
      content: [{ type: 'text' as const, text: responseText }],
      warnings: [],
    }),
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: responseText },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
      ]),
    }),
  });
}

// Helper: create a WorkingMemory instance for unit testing private methods
function createWorkingMemoryInstance() {
  const storage = {
    getThreadById: vi.fn(),
    getResourceById: vi.fn(),
  } as any;

  return new WorkingMemory({ storage });
}

describe('Bug 1: generateEmptyFromSchema', () => {
  // Access private method via any cast for testing
  function callGenerateEmptyFromSchema(schema: any) {
    const wm = createWorkingMemoryInstance();
    return (wm as any).generateEmptyFromSchema(schema);
  }

  it('should handle string schema input (JSON string)', () => {
    // BUG: generateEmptyFromSchema does not parse string schemas.
    // It only checks `typeof schema === "object"`, so a JSON string
    // is treated as non-object and returns null.
    const jsonSchema = JSON.stringify({
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
    });

    const result = callGenerateEmptyFromSchema(jsonSchema);

    // Current behavior: returns null (string is not an object)
    // Expected behavior: should parse JSON string and return { name: "", age: 0 }
    expect(result).toBeNull(); // Documents current (buggy) behavior
    // TODO: After fix:
    // expect(result).toEqual({ name: '', age: 0 });
  });

  it('should handle nested objects with properties', () => {
    // BUG: generateEmptyFromSchema checks `schema[key]?.type === "object"`
    // but then recurses with `schema[key].properties`, which may not have
    // the correct structure for nested object processing.
    const schema = {
      user: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          address: {
            type: 'object',
            properties: {
              city: { type: 'string' },
              zip: { type: 'string' },
            },
          },
        },
      },
      settings: {
        type: 'array',
      },
    };

    const result = callGenerateEmptyFromSchema(schema);

    // Verify basic structure is created
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('settings');
    expect(result!.settings).toEqual([]);
  });

  it('should handle schema with default values', () => {
    // BUG: generateEmptyFromSchema ignores `default` property in schema.
    // Fields with defaults should use the default value instead of type-based empty value.
    const schema = {
      language: {
        type: 'string',
        default: 'en',
      },
      count: {
        type: 'number',
        default: 10,
      },
      active: {
        type: 'boolean',
      },
    };

    const result = callGenerateEmptyFromSchema(schema);

    expect(result).not.toBeNull();
    // Current behavior: all values are '' regardless of type or default
    expect(result!.language).toBe(''); // BUG: should be 'en'
    expect(result!.count).toBe(''); // BUG: should be 10
    expect(result!.active).toBe(''); // BUG: should be false
    // TODO: After fix:
    // expect(result!.language).toBe('en');
    // expect(result!.count).toBe(10);
    // expect(result!.active).toBe(false);
  });

  it('should return proper type defaults for number/integer/boolean', () => {
    // BUG: generateEmptyFromSchema returns '' for all non-object/non-array types.
    // Numbers should default to 0, booleans to false.
    const schema = {
      count: { type: 'number' },
      index: { type: 'integer' },
      enabled: { type: 'boolean' },
      label: { type: 'string' },
    };

    const result = callGenerateEmptyFromSchema(schema);

    expect(result).not.toBeNull();
    // Current behavior: all return ''
    expect(result!.count).toBe(''); // BUG: should be 0
    expect(result!.index).toBe(''); // BUG: should be 0
    expect(result!.enabled).toBe(''); // BUG: should be false
    expect(result!.label).toBe(''); // Correct
    // TODO: After fix:
    // expect(result!.count).toBe(0);
    // expect(result!.index).toBe(0);
    // expect(result!.enabled).toBe(false);
  });
});

describe('Bug 2: Thread metadata overwrite instead of merge', () => {
  let dummyModel: MockLanguageModelV2;

  beforeEach(() => {
    dummyModel = createDummyModel();
  });

  it('should preserve existing metadata fields when updating with new fields', async () => {
    // BUG: When updating thread metadata, the code does:
    //   { ...existingThread, metadata: thread.metadata }
    // instead of:
    //   { ...existingThread, metadata: { ...existingThread.metadata, ...thread.metadata } }
    // This overwrites all existing metadata fields.
    const mockMemory = new MockMemory();

    // Create thread with initial metadata
    const initialThread = {
      id: 'thread-merge-test',
      resourceId: 'user-1',
      metadata: { existingField: 'should-persist', client: 'initial' },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await mockMemory.saveThread({ thread: initialThread });

    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'test',
      model: dummyModel,
      memory: mockMemory,
    });

    // Update with new metadata that only includes 'client'
    await agent.generate('hello', {
      memory: {
        resource: 'user-1',
        thread: {
          id: 'thread-merge-test',
          metadata: { client: 'updated' },
        },
      },
    });

    const thread = await mockMemory.getThreadById({ threadId: 'thread-merge-test' });

    // Verify updated field
    expect(thread?.metadata?.client).toBe('updated');

    // BUG: existingField is lost because metadata is overwritten, not merged
    // Current behavior: existingField is undefined
    // Expected behavior: existingField should persist
    expect(thread?.metadata?.existingField).toBeUndefined(); // Documents current (buggy) behavior
    // TODO: After fix:
    // expect(thread?.metadata?.existingField).toBe('should-persist');
  });
});

describe('Bug 4: working_memory_data empty on initial interaction', () => {
  it('should show template structure in working_memory_data when data is null', () => {
    // BUG: When data is null (first interaction), <working_memory_data> is empty.
    // The LLM has no reference for the expected JSON structure, making the first
    // updateWorkingMemory call unreliable.
    const wm = createWorkingMemoryInstance();

    const jsonTemplate = {
      format: 'json' as const,
      content: JSON.stringify({
        type: 'object',
        properties: {
          name: { type: 'string' },
          interests: { type: 'array' },
        },
      }),
    };

    const instruction = (wm as any).getWorkingMemoryToolInstruction({
      template: jsonTemplate,
      data: null, // First interaction, no data yet
    });

    // BUG: The instruction contains <working_memory_data>\nnull\n</working_memory_data>
    // The LLM sees "null" instead of the empty template structure.
    expect(instruction).toContain('<working_memory_data>');

    // Extract the content between working_memory_data tags
    const match = instruction.match(/<working_memory_data>\n([\s\S]*?)\n<\/working_memory_data>/);
    const dataContent = match?.[1]?.trim();

    // Current behavior: data is "null" (the string representation of null)
    expect(dataContent).toBe('null'); // Documents current (buggy) behavior
    // TODO: After fix, should show the empty template:
    // expect(dataContent).not.toBe('null');
    // const parsed = JSON.parse(dataContent!);
    // expect(parsed).toEqual({ name: '', interests: [] });
  });
});

describe('Bug 5: updateWorkingMemory tool description instructs full content', () => {
  it('should instruct partial updates for JSON format', () => {
    // BUG: The instruction says "REMEMBER: the way you update your working memory
    // is by calling the updateWorkingMemory tool with the entire JSON content."
    // This forces the LLM to re-send the complete working memory on every update,
    // even when only one field changed, wasting tokens.
    const wm = createWorkingMemoryInstance();

    const jsonTemplate = {
      format: 'json' as const,
      content: JSON.stringify({
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      }),
    };

    const instruction = (wm as any).getWorkingMemoryToolInstruction({
      template: jsonTemplate,
      data: '{"name": "Alice"}',
    });

    // BUG: Instruction tells LLM to send "entire" content
    expect(instruction).toContain('with the entire JSON content'); // Documents current (buggy) behavior
    // TODO: After fix, should instruct partial updates:
    // expect(instruction).toContain('partial update');
    // expect(instruction).not.toContain('with the entire');
  });
});

describe('Bug 3: Working Memory partial JSON update (MockMemory)', () => {
  it('should preserve unchanged fields when updating working memory with partial data', async () => {
    // BUG: When the LLM sends a partial JSON update (only changed fields),
    // the entire working memory is replaced. Unchanged fields are lost.
    const mockMemory = new MockMemory({
      enableWorkingMemory: true,
      workingMemoryTemplate: JSON.stringify({
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
          location: { type: 'string' },
        },
      }),
    });

    // Simulate saving initial working memory
    const initialThread = {
      id: 'thread-wm-partial',
      resourceId: 'user-1',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await mockMemory.saveThread({ thread: initialThread });

    // Set initial working memory
    await mockMemory.updateWorkingMemory({
      threadId: 'thread-wm-partial',
      resourceId: 'user-1',
      workingMemory: JSON.stringify({ name: 'Alice', age: 30, location: 'NYC' }),
    });

    // Verify initial state
    const initialWM = await mockMemory.getWorkingMemory({
      threadId: 'thread-wm-partial',
      resourceId: 'user-1',
    });
    expect(initialWM).toBeDefined();
    const initialParsed = JSON.parse(initialWM!);
    expect(initialParsed).toEqual({ name: 'Alice', age: 30, location: 'NYC' });

    // Now simulate partial update (only change location)
    await mockMemory.updateWorkingMemory({
      threadId: 'thread-wm-partial',
      resourceId: 'user-1',
      workingMemory: JSON.stringify({ location: 'LA' }),
    });

    const updatedWM = await mockMemory.getWorkingMemory({
      threadId: 'thread-wm-partial',
      resourceId: 'user-1',
    });
    expect(updatedWM).toBeDefined();
    const updatedParsed = JSON.parse(updatedWM!);

    // BUG: Partial update replaces entire content - name and age are lost
    // Current behavior: only { location: 'LA' }
    expect(updatedParsed.location).toBe('LA'); // Updated field is correct
    expect(updatedParsed.name).toBeUndefined(); // BUG: name is lost
    expect(updatedParsed.age).toBeUndefined(); // BUG: age is lost
    // TODO: After fix:
    // expect(updatedParsed.name).toBe('Alice');
    // expect(updatedParsed.age).toBe(30);
  });
});
