import { mkdtemp } from 'fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'os';
import { join } from 'path';
import { Agent } from '@mastra/core/agent';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';

describe('Reasoning Memory Tests', () => {
  let memory: Memory;
  let storage: LibSQLStore;

  beforeEach(async () => {
    // Create a new unique database file in the temp directory for each test
    const dbPath = join(await mkdtemp(join(tmpdir(), 'reasoning-memory-test-')), 'test.db');

    storage = new LibSQLStore({
      url: `file:${dbPath}`,
    });

    memory = new Memory({
      storage,
      options: {
        lastMessages: 10,
        semanticRecall: false,
        threads: { generateTitle: false },
      },
    });
  });

  afterEach(async () => {
    //@ts-ignore
    await storage.client?.close();
  });

  it('should preserve reasoning text when saving and retrieving from memory', async () => {
    const agent = new Agent({
      name: 'reasoning-test-agent',
      instructions: 'You are a helpful assistant that thinks through problems.',
      model: 'openrouter/openai/gpt-oss-20b',
      memory,
    });

    const threadId = randomUUID();
    const resourceId = 'test-resource-reasoning';

    // Generate a response with reasoning
    const result = await agent.generate('What is 2+2? Think through this carefully.', {
      threadId,
      resourceId,
    });

    // Verify we got reasoning in the response
    expect(result.reasoning.length).toBeGreaterThan(0);
    expect(result.reasoningText).toBeDefined();
    expect(result.reasoningText!.length).toBeGreaterThan(0);

    // Store the original reasoning for comparison
    const originalReasoningText = result.reasoningText;

    // Retrieve the thread from memory
    const agentMemory = (await agent.getMemory())!;
    const { messages } = await agentMemory.query({ threadId });

    // Find the assistant message with reasoning
    // In V1 messages, content is an array directly (not content.parts)
    const assistantMessage = messages.find(
      (m: any) =>
        m.role === 'assistant' && Array.isArray(m.content) && m.content.some((p: any) => p?.type === 'reasoning'),
    );

    expect(assistantMessage).toBeDefined();

    // Extract reasoning parts from the retrieved message
    // In V1 messages, content is the array directly
    const retrievedReasoningParts = Array.isArray((assistantMessage as any).content)
      ? (assistantMessage as any).content.filter((p: any) => p?.type === 'reasoning')
      : [];

    expect(retrievedReasoningParts).toBeDefined();
    expect(retrievedReasoningParts.length).toBeGreaterThan(0);

    // Verify the reasoning content is preserved
    // In V1 messages, reasoning parts have 'text' field directly
    const retrievedReasoningText = retrievedReasoningParts.map((p: any) => p.text || '').join('');

    expect(retrievedReasoningText.length).toBeGreaterThan(0);
    expect(retrievedReasoningText).toBe(originalReasoningText);

    // Verify that we have exactly ONE consolidated reasoning part (not split into multiple)
    // This is the key fix - before the bug, reasoning was split into many word-level parts
    expect(retrievedReasoningParts.length).toBe(1);
  }, 30000);
});
