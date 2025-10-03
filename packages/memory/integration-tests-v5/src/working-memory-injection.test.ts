import { describe, it, expect, beforeEach } from 'vitest';
import { Agent } from '@mastra/core';
// @ts-ignore - Import from dist
import { WorkingMemoryProcessor } from '@mastra/core/dist/processors/index.js';
import { openai } from '@ai-sdk/openai';
import { Memory } from '@mastra/memory';
// @ts-ignore - Import from package
import { SqliteStorage } from '@mastra/memory/storages';
// @ts-ignore - Import from package
import { FnEmbedder } from '@mastra/memory/embedders';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdirSync } from 'fs';

describe('WorkingMemory Injection Test', () => {
  it('should inject context without errors', async () => {
    // Create temp DB
    const testDir = join(tmpdir(), `wm-inject-test-${Date.now()}${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    const testDbPath = join(testDir, 'test.db');
    console.log('Test DB Path:', testDbPath);

    // Simple mock embedder
    const mockEmbed = async (input: string) => {
      return new Array(256).fill(0.1);
    };
    const fastembed = new FnEmbedder(mockEmbed, 256);

    // Create storage
    const storage = new SqliteStorage({
      filePath: testDbPath,
    });

    // Create memory
    const memory = new Memory({
      storage: {
        provider: storage,
      },
      embedder: fastembed,
    });

    // Create processor WITHOUT extraction (just injection)
    const processor = new WorkingMemoryProcessor({
      storage: storage as any,
      model: openai('gpt-4o-mini'),
      scope: 'resource',
      extractFromUserMessages: false, // No extraction
      injectionStrategy: 'system',
    });

    // Create agent
    const agent = new Agent({
      name: 'Test Agent',
      instructions: 'You are a helpful assistant.',
      model: openai('gpt-4o-mini'),
      memory,
      inputProcessors: [processor], // Only input processor for injection
      // No output processor - we don't need extraction
    });

    // Create thread
    const thread = await memory.createThread({
      resourceId: 'test-resource',
    });

    // Manually set some working memory
    const resourceId = 'test-resource';
    await storage.stores?.memory?.upsertResource({
      resourceId,
      workingMemory: '# User Info\n- Name: TestUser',
    });

    console.log('Set working memory manually');

    // Now try to generate - this should inject the context
    try {
      const response = await agent.generate('Hello', {
        memory: {
          thread: thread.id,
          resourceId,
        },
        maxSteps: 1,
      });

      console.log('SUCCESS! Response:', response.text);
      expect(response.text).toBeDefined();
    } catch (error) {
      console.error('FAILED! Error during generate:', error);
      throw error;
    }

    //@ts-ignore
    await storage.client?.close();
  });
});
