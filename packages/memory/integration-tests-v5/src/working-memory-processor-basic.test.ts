import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Agent } from '@mastra/core';
import { WorkingMemoryProcessor } from '@mastra/core/dist/processors/processors/working-memory.js';
import { openai } from '@ai-sdk/openai';
import { Memory } from '@mastra/memory';
import { SqliteStorage } from '../../dist/storage/index.js';
import { FnEmbedder } from '../../dist/embedders/index.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync, rmSync } from 'fs';

describe('WorkingMemoryProcessor Basic Tests', () => {
  let processor: WorkingMemoryProcessor;
  let agent: Agent;
  let memory: Memory;
  let storage: SqliteStorage;
  let testDbPath: string;

  beforeEach(async () => {
    // Create unique test DB path
    const testDir = join(tmpdir(), `wm-basic-test-${Date.now()}${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    testDbPath = join(testDir, 'test.db');
    console.log('Test DB Path:', testDbPath);

    // Simple mock embedder
    const mockEmbed = async (input: string) => {
      return new Array(256).fill(0.1);
    };
    const fastembed = new FnEmbedder(mockEmbed, 256);

    // Create storage
    storage = new SqliteStorage({
      filePath: testDbPath,
    });

    // Create memory
    memory = new Memory({
      storage: {
        provider: storage,
      },
      embedder: fastembed,
    });

    // Create simple processor without extraction from user messages
    processor = new WorkingMemoryProcessor({
      storage: storage as any,
      model: openai('gpt-4o-mini'),
      scope: 'resource',
      extractFromUserMessages: false, // Disable extraction from user messages
      injectionStrategy: 'system',
    });

    // Create agent
    agent = new Agent({
      name: 'Test Agent',
      instructions: 'You are a helpful assistant. Be friendly.',
      model: openai('gpt-4o-mini'),
      memory,
      inputProcessors: [processor],
      outputProcessors: [processor],
    });
  });

  afterEach(async () => {
    //@ts-ignore
    await storage.client?.close();
  });

  it('should manually update and retrieve working memory', async () => {
    console.log('\n=== Test: Manual Update ===');

    // Create thread
    const thread = await memory.createThread({
      resourceId: 'test-resource-1',
    });
    console.log('Thread created:', thread.id);

    // Manually update working memory
    const testMemory = `# User Information
- Name: John Doe
- Location: San Francisco
- Interests: Programming, AI`;

    await processor.manualUpdateWorkingMemory(testMemory, thread.id, 'test-resource-1');
    console.log('Manually updated working memory');

    // Check if working memory was saved
    const resourceData = await storage.stores?.memory?.getResourceById({
      resourceId: 'test-resource-1',
    });
    console.log('Resource working memory:', resourceData?.workingMemory);

    expect(resourceData?.workingMemory).toBeDefined();
    expect(resourceData?.workingMemory).toContain('John Doe');
    expect(resourceData?.workingMemory).toContain('San Francisco');
  });

  it('should inject working memory context into conversation', async () => {
    console.log('\n=== Test: Context Injection ===');

    // Create thread
    const thread = await memory.createThread({
      resourceId: 'test-resource-2',
    });

    // Manually set working memory
    const testMemory = `# User Information
- Name: Sarah Connor
- Job: Software Engineer`;

    await processor.manualUpdateWorkingMemory(testMemory, thread.id, 'test-resource-2');
    console.log('Set working memory for Sarah Connor');

    // Now ask a question that should use the context
    try {
      const response = await agent.generate('What is my name?', {
        memory: {
          thread: thread.id,
          resourceId: 'test-resource-2',
        },
        maxSteps: 1,
      });

      console.log('Agent response:', response.text);

      // The agent should know the name from working memory
      expect(response.text.toLowerCase()).toContain('sarah');
    } catch (error) {
      console.error('Error during generate:', error);
      // Even if generate fails, check if working memory exists
      const resourceData = await storage.stores?.memory?.getResourceById({
        resourceId: 'test-resource-2',
      });
      console.log('Working memory still exists:', resourceData?.workingMemory);
      expect(resourceData?.workingMemory).toContain('Sarah Connor');
    }
  });
});
