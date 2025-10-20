import fs from 'fs';
import { randomUUID } from 'node:crypto';
import path from 'path';
import { Agent } from '@mastra/core/agent';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';

describe('Reasoning Memory Tests', () => {
  const testDbPath = path.join(import.meta.dirname, `test-reasoning-${randomUUID()}.db`);
  let memory: Memory;

  beforeAll(() => {
    memory = new Memory({
      storage: new LibSQLStore({
        url: `file:${testDbPath}`,
      }),
      options: {
        lastMessages: 10,
        semanticRecall: false,
        threads: { generateTitle: false },
      },
    });
  });

  afterAll(() => {
    // Clean up test database
    try {
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
      if (fs.existsSync(`${testDbPath}-shm`)) {
        fs.unlinkSync(`${testDbPath}-shm`);
      }
      if (fs.existsSync(`${testDbPath}-wal`)) {
        fs.unlinkSync(`${testDbPath}-wal`);
      }
    } catch (e) {
      console.error('Failed to clean up test database:', e);
    }
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

    console.log('\n=== GENERATED RESPONSE ===');
    console.log('Text:', result.text);
    console.log('Reasoning text:', result.reasoningText);
    console.log('Has reasoning:', result.reasoning.length > 0);

    // Verify we got reasoning in the response
    expect(result.reasoning.length).toBeGreaterThan(0);
    expect(result.reasoningText).toBeDefined();
    expect(result.reasoningText!.length).toBeGreaterThan(0);

    // Store the original reasoning for comparison
    const originalReasoningText = result.reasoningText;
    const originalReasoningParts = result.reasoning;

    console.log('\n=== ORIGINAL REASONING ===');
    console.log('Reasoning text length:', originalReasoningText?.length);
    console.log('Reasoning parts count:', originalReasoningParts.length);
    console.log('First reasoning part text:', originalReasoningParts[0]?.payload?.text?.substring(0, 100));

    // Retrieve the thread from memory
    const agentMemory = (await agent.getMemory())!;
    const { messages, uiMessages } = await agentMemory.query({ threadId });

    console.log('\n=== RETRIEVED FROM MEMORY ===');
    console.log('Messages count:', messages.length);
    console.log('UI Messages count:', uiMessages?.length);

    // Debug: log all messages to see their structure
    console.log('\n=== ALL MESSAGES STRUCTURE ===');
    messages.forEach((m: any, idx: number) => {
      console.log(`Message ${idx}:`, JSON.stringify(m, null, 2));
    });

    // Find the assistant message with reasoning
    // In V1 messages, content is an array directly (not content.parts)
    const assistantMessage = messages.find(
      (m: any) =>
        m.role === 'assistant' && Array.isArray(m.content) && m.content.some((p: any) => p?.type === 'reasoning'),
    );

    expect(assistantMessage).toBeDefined();
    console.log('\n=== ASSISTANT MESSAGE CONTENT ===');
    // @ts-expect-error - Type says CoreMessage but actually returns MastraMessageV1 with id field
    console.log('Message ID:', assistantMessage!.id);
    console.log('Content is array:', Array.isArray((assistantMessage as any).content));
    console.log('Content parts count:', (assistantMessage as any).content?.length);

    // Extract reasoning parts from the retrieved message
    // In V1 messages, content is the array directly
    const retrievedReasoningParts = Array.isArray((assistantMessage as any).content)
      ? (assistantMessage as any).content.filter((p: any) => p?.type === 'reasoning')
      : [];

    console.log('\n=== RETRIEVED REASONING PARTS ===');
    console.log('Reasoning parts count:', retrievedReasoningParts?.length);

    if (retrievedReasoningParts && retrievedReasoningParts.length > 0) {
      console.log('First reasoning part structure:', JSON.stringify(retrievedReasoningParts[0], null, 2));

      // Check if reasoning is in the correct format
      const firstPart = retrievedReasoningParts[0];
      console.log('\nFirst part has reasoning field:', 'reasoning' in firstPart);
      console.log('First part has details field:', 'details' in firstPart);

      if ('reasoning' in firstPart) {
        console.log('Reasoning field value:', firstPart.reasoning?.substring(0, 100));
        console.log('Reasoning field length:', firstPart.reasoning?.length);
      }

      if ('details' in firstPart && Array.isArray(firstPart.details)) {
        console.log('Details array length:', firstPart.details.length);
        console.log('Details structure:', JSON.stringify(firstPart.details.slice(0, 3), null, 2));

        // Check if details are corrupted (many single-word chunks)
        const textLengths: number[] = firstPart.details
          .filter((d: any) => d?.type === 'text')
          .map((d: any) => d.text?.length || 0);
        console.log('Text chunk lengths:', textLengths.slice(0, 10));

        // If we have many short chunks, it's likely corrupted
        const shortChunks = textLengths.filter(len => len < 10);
        console.log('Short chunks (< 10 chars):', shortChunks.length, 'out of', textLengths.length);

        // Reconstruct text from details
        const reconstructedText = firstPart.details
          .filter((d: any) => d?.type === 'text')
          .map((d: any) => d.text || '')
          .join('');
        console.log('Reconstructed text from details:', reconstructedText?.substring(0, 100));
        console.log('Reconstructed text length:', reconstructedText?.length);
      }
    }

    // Now check the UI messages
    if (uiMessages && uiMessages.length > 0) {
      console.log('\n=== UI MESSAGES ===');
      const uiAssistantMessage = uiMessages.find(
        (m: any) =>
          m.role === 'assistant' && Array.isArray(m.parts) && m.parts.some((p: any) => p?.type === 'reasoning'),
      );

      if (uiAssistantMessage) {
        const uiReasoningParts = (uiAssistantMessage as any).parts?.filter((p: any) => p?.type === 'reasoning');
        console.log('UI reasoning parts count:', uiReasoningParts?.length);
        if (uiReasoningParts && uiReasoningParts.length > 0) {
          console.log('UI first reasoning part:', JSON.stringify(uiReasoningParts[0], null, 2));
        }
      }
    }

    // Verify reasoning parts are not empty
    expect(retrievedReasoningParts).toBeDefined();
    expect(retrievedReasoningParts.length).toBeGreaterThan(0);

    // Verify the reasoning content is preserved
    // In V1 messages, reasoning parts have 'text' field directly (not 'reasoning' or 'details')
    const retrievedReasoningText = retrievedReasoningParts.map((p: any) => p.text || '').join('');

    console.log('\n=== COMPARISON ===');
    console.log('Original reasoning text length:', originalReasoningText?.length);
    console.log('Retrieved reasoning text length:', retrievedReasoningText?.length);
    console.log('Match:', originalReasoningText === retrievedReasoningText);

    // The reasoning text should be preserved
    expect(retrievedReasoningText.length).toBeGreaterThan(0);
    expect(retrievedReasoningText).toBe(originalReasoningText);

    // Verify that we have exactly ONE consolidated reasoning part (not split into multiple)
    // This is the key fix - before the bug, reasoning was split into many word-level parts
    expect(retrievedReasoningParts.length).toBe(1);
    console.log('✓ Reasoning is consolidated into ONE part (not split into multiple chunks)');
  }, 30000);
});
