import { randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { fastembed } from '@mastra/fastembed';
import { LibSQLVector, LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

const resourceId = 'test-resource';

// Helper function at the top of the file (outside the test)
function getErrorDetails(error: any): string | undefined {
  if (!error) return undefined;
  if (error.message) return error.message;
  if (typeof error === 'string') return error;
  return JSON.stringify(error);
}

/**
 * Shared test suite for agent network with working memory.
 * Can be run with any memory configuration (thread/resource scope, standard/vnext).
 */
function runWorkingMemoryTests(getMemory: () => Memory) {
  it('should call memory tool directly and end loop when only memory update needed', async () => {
    const memory = getMemory();
    const networkAgent = new Agent({
      id: 'network-orchestrator',
      name: 'network-orchestrator',
      instructions: 'You help users and can remember things when they ask you to.',
      model: openai('gpt-4o'),
      memory,
    });

    const threadId = randomUUID();

    const chunks: any[] = [];

    const result = await networkAgent.network('Please remember my email is test@example.com', {
      memory: { thread: threadId, resource: resourceId },
      maxSteps: 3, // Limit iterations to avoid infinite loops
    });

    for await (const chunk of result) {
      chunks.push(chunk);
    }

    // After stream completes, check the workflow execution status
    const executionResult = await result.result;
    const errorDetails = executionResult?.status === 'failed' ? getErrorDetails(executionResult.error) : undefined;
    expect(errorDetails).toBeUndefined();
    expect(executionResult?.status).not.toBe('failed');

    // Verify:
    // 1. Working memory was updated
    const workingMemory = await memory.getWorkingMemory({ threadId, resourceId });
    expect(workingMemory).toBeTruthy();
    expect(workingMemory).toContain('test@example.com');

    // 2. Loop ended after memory update (no tool execution chunks, only routing + done)
    const stepTypes = chunks.map(c => c.type);
    expect(stepTypes).not.toContain('tool-call'); // No tool execution step

    // 3. No errors occurred
    expect(chunks.some(c => c.type?.includes('error'))).toBe(false);
  });

  it('should call memory tool and then query agent in same network call', async () => {
    const memory = getMemory();

    // Create a math agent that can do calculations
    const mathAgent = new Agent({
      name: 'math-agent',
      instructions: 'You are a helpful math assistant.',
      model: openai('gpt-4o'),
    });

    const networkAgent = new Agent({
      id: 'network-orchestrator',
      name: 'network-orchestrator',
      instructions: 'You help users with math and remember things.',
      model: openai('gpt-4o'),
      agents: { mathAgent },
      memory,
    });

    const threadId = randomUUID();

    const chunks: any[] = [];

    const result = await networkAgent.network(
      'Remember that my favorite number is 42, then calculate what 42 multiplied by 3 is',
      {
        memory: { thread: threadId, resource: resourceId },
        maxSteps: 5, // Allow multiple steps for memory + agent
      },
    );

    for await (const chunk of result) {
      chunks.push(chunk);
    }

    // After stream completes, check the workflow execution status
    const executionResult = await result.result;
    const errorDetails = executionResult?.status === 'failed' ? getErrorDetails(executionResult.error) : undefined;
    expect(errorDetails).toBeUndefined();
    expect(executionResult?.status).not.toBe('failed');

    // Verify:
    // 1. Working memory was updated with favorite number
    const workingMemory = await memory.getWorkingMemory({ threadId, resourceId });
    expect(workingMemory).toBeTruthy();
    expect(workingMemory).toContain('42');

    // 2. Math agent was queried (should see agent-execution chunks)
    const stepTypes = chunks.map(c => c.type);
    expect(stepTypes).toContain('agent-execution');

    // 3. Final result contains calculation answer (126)
    const textChunks = chunks.filter(c => c.type === 'text-delta' || c.type === 'text');
    const fullText = textChunks.map(c => c.textDelta || c.text || '').join('');
    expect(fullText).toContain('126');

    // 4. No errors occurred
    expect(chunks.some(c => c.type?.includes('error'))).toBe(false);
  });

  it('should call memory tool and then execute user-defined tool', async () => {
    const memory = getMemory();

    // Create a weather tool
    const getWeather = createTool({
      id: 'get-weather',
      description: 'Get current weather for a city',
      inputSchema: z.object({ city: z.string() }),
      execute: async ({ context }) => {
        return { city: context.city, temp: 72, condition: 'sunny' };
      },
    });

    const networkAgent = new Agent({
      id: 'network-orchestrator',
      name: 'network-orchestrator',
      instructions: 'You help users with weather and remember their preferences.',
      model: openai('gpt-4o'),
      tools: { getWeather },
      memory,
    });

    const threadId = randomUUID();

    const chunks: any[] = [];

    const result = await networkAgent.network(
      'Remember that I live in San Francisco, then get me the weather for my city',
      {
        memory: { thread: threadId, resource: resourceId },
        maxSteps: 5, // Allow multiple steps for memory + tool
      },
    );

    for await (const chunk of result) {
      chunks.push(chunk);
    }

    // After stream completes, check the workflow execution status
    const executionResult = await result.result;
    const errorDetails = executionResult?.status === 'failed' ? getErrorDetails(executionResult.error) : undefined;
    expect(errorDetails).toBeUndefined();
    expect(executionResult?.status).not.toBe('failed');

    // Verify:
    // 1. Working memory was updated with location
    const workingMemory = await memory.getWorkingMemory({ threadId, resourceId });
    expect(workingMemory?.toLowerCase()).toContain('san francisco');

    // 2. Weather tool was executed (should see tool-call chunks)
    const toolCalls = chunks.filter(c => c.type === 'tool-call');
    expect(toolCalls.length).toBeGreaterThan(0);
    expect(toolCalls.some((t: any) => t.toolName === 'get-weather')).toBe(true);

    // 3. Final result contains weather information
    const textChunks = chunks.filter(c => c.type === 'text-delta' || c.type === 'text');
    const fullText = textChunks.map(c => c.textDelta || c.text || '').join('');
    expect(fullText.toLowerCase()).toMatch(/weather|sunny|72/);

    // 4. No errors occurred
    expect(chunks.some(c => c.type?.includes('error'))).toBe(false);
  });

  it('should handle multiple memory updates in conversation flow', async () => {
    const memory = getMemory();

    const networkAgent = new Agent({
      id: 'network-orchestrator',
      name: 'network-orchestrator',
      instructions: 'You help users and remember things they tell you.',
      model: openai('gpt-4o'),
      memory,
    });

    const threadId = randomUUID();

    // First request: remember name
    const result1 = await networkAgent.network('My name is Alice', {
      memory: { thread: threadId, resource: resourceId },
      maxSteps: 3,
    });
    for await (const _chunk of result1) {
    }

    // After stream completes, check the workflow execution status
    const executionResult = await result1.result;
    const errorDetails = executionResult?.status === 'failed' ? getErrorDetails(executionResult.error) : undefined;
    expect(errorDetails).toBeUndefined();
    expect(executionResult?.status).not.toBe('failed');

    // Second request: remember occupation
    const result2 = await networkAgent.network('I work as a software engineer', {
      memory: { thread: threadId, resource: resourceId },
      maxSteps: 3,
    });
    for await (const _chunk of result2) {
    }

    // After stream completes, check the workflow execution status
    const executionResult2 = await result2.result;
    const errorDetails2 = executionResult2?.status === 'failed' ? getErrorDetails(executionResult2.error) : undefined;
    expect(errorDetails2).toBeUndefined();
    expect(executionResult2?.status).not.toBe('failed');

    // Verify both pieces of information are in working memory
    const workingMemory = await memory.getWorkingMemory({ threadId, resourceId });
    expect(workingMemory).toContain('Alice');
    expect(workingMemory?.toLowerCase()).toContain('software engineer');
  });

  it('should work when routing to a sub-agent with memory capabilities', async () => {
    const memory = getMemory();

    // Create a sub-agent that has memory capabilities
    const memoryAgent = new Agent({
      name: 'memory-agent',
      instructions: 'You are a helpful assistant that can remember things when asked.',
      description: 'Agent that can use working memory to remember user preferences',
      model: openai('gpt-4o'),
      memory,
    });

    // Create network orchestrator that can route to the memory agent
    const networkAgent = new Agent({
      id: 'network-orchestrator',
      name: 'network-orchestrator',
      instructions: 'You can route tasks to specialized agents. Use memory-agent for remembering things.',
      model: openai('gpt-4o'),
      agents: {
        memoryAgent,
      },
      memory,
    });

    const threadId = randomUUID();

    const chunks: any[] = [];

    const result = await networkAgent.network('Please remember that my favorite color is purple', {
      memory: { thread: threadId, resource: resourceId },
      maxSteps: 5, // Allow routing to sub-agent
    });

    for await (const chunk of result) {
      chunks.push(chunk);
    }

    // After stream completes, check the workflow execution status
    const executionResult = await result.result;
    const errorDetails = executionResult?.status === 'failed' ? getErrorDetails(executionResult.error) : undefined;
    expect(errorDetails).toBeUndefined();
    expect(executionResult?.status).not.toBe('failed');

    // Verify working memory was updated
    const workingMemory = await memory.getWorkingMemory({ threadId, resourceId });
    expect(workingMemory).toBeTruthy();
    expect(workingMemory?.toLowerCase()).toContain('purple');

    // No errors occurred
    expect(chunks.some(c => c.type?.includes('error'))).toBe(false);
  });
}

describe('Agent Network with Working Memory', () => {
  let storage: LibSQLStore;
  let vector: LibSQLVector;

  beforeEach(async () => {
    // Create a new unique database file in the temp directory for each test
    const dbPath = join(await mkdtemp(join(tmpdir(), `memory-network-test-${Date.now()}`)), 'test.db');

    storage = new LibSQLStore({
      url: `file:${dbPath}`,
    });
    vector = new LibSQLVector({
      connectionUrl: `file:${dbPath}`,
    });
  });

  afterEach(async () => {
    //@ts-ignore
    await storage.client.close();
    //@ts-ignore
    await vector.turso.close();
  });

  describe('Standard Working Memory Tool - Thread Scope', () => {
    let memory: Memory;

    beforeEach(() => {
      memory = new Memory({
        options: {
          workingMemory: {
            enabled: true,
            scope: 'thread',
          },
          lastMessages: 10,
        },
        storage,
        vector,
        embedder: fastembed,
      });
    });

    runWorkingMemoryTests(() => memory);
  });

  describe('Standard Working Memory Tool - Resource Scope', () => {
    let memory: Memory;

    beforeEach(() => {
      memory = new Memory({
        options: {
          workingMemory: {
            enabled: true,
            scope: 'resource',
          },
          lastMessages: 10,
        },
        storage,
        vector,
        embedder: fastembed,
      });
    });

    runWorkingMemoryTests(() => memory);
  });

  describe('Experimental Working Memory Tool - Thread Scope', () => {
    let memory: Memory;

    beforeEach(() => {
      memory = new Memory({
        options: {
          workingMemory: {
            enabled: true,
            scope: 'thread',
            version: 'vnext',
            template: `# User Information
- **First Name**:
- **Last Name**:
- **Preferences**: `,
          },
          lastMessages: 10,
        },
        storage,
        vector,
        embedder: fastembed,
      });
    });

    runWorkingMemoryTests(() => memory);
  });

  describe('Experimental Working Memory Tool - Resource Scope', () => {
    let memory: Memory;

    beforeEach(() => {
      memory = new Memory({
        options: {
          workingMemory: {
            enabled: true,
            scope: 'resource',
            version: 'vnext',
            template: `# User Information
- **First Name**:
- **Last Name**:
- **Preferences**: `,
          },
          lastMessages: 10,
        },
        storage,
        vector,
        embedder: fastembed,
      });
    });

    runWorkingMemoryTests(() => memory);
  });
});
