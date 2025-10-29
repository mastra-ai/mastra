import { randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { fastembed } from '@mastra/fastembed';
import { LibSQLVector, LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';

const resourceId = 'test-resource';

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

  describe('Standard updateWorkingMemory Tool', () => {
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

    it('should successfully update working memory even when LLM adds function prefix', async () => {
      // Create an agent that has memory capabilities
      const memoryAgent = new Agent({
        name: 'memory-agent',
        instructions: 'You are a helpful assistant that can remember things when asked.',
        description: 'Agent that can use working memory',
        model: openai('gpt-4o'),
        memory,
      });

      // Create the network orchestrator agent with explicit instructions about JSON
      const networkAgent = new Agent({
        id: 'network-orchestrator',
        name: 'network-orchestrator',
        instructions: `You help users and can remember things when they ask you to.
You have access to tools that require JSON input. Make sure to format tool inputs correctly.`,
        model: openai('gpt-4o'),
        agents: {
          memoryAgent,
        },
        memory,
      });

      const threadId = randomUUID();

      // Track all chunks to see what happened
      const chunks: any[] = [];
      let errorOccurred = false;
      let errorMessage = '';

      try {
        const result = await networkAgent.network('Please remember that my name is John', {
          memory: {
            thread: threadId,
            resource: resourceId,
          },
          maxSteps: 2, // Limit iterations to avoid infinite loops
        });

        // Consume the stream and capture all events
        for await (const chunk of result) {
          chunks.push(chunk);
        }
      } catch (error: any) {
        errorOccurred = true;
        errorMessage = error.message;
      }

      // Try to get working memory
      const workingMemory = await memory.getWorkingMemory({ threadId, resourceId });

      // With the fix, working memory should be successfully updated
      // even though the LLM adds "functions." prefix to the tool name
      expect(workingMemory).toBeTruthy();
      expect(workingMemory).toContain('John');
      expect(errorOccurred).toBe(false);
    });

    it('should handle working memory tools in agent network - thread scope', async () => {
      // Create an agent that has memory capabilities
      const memoryAgent = new Agent({
        name: 'memory-agent',
        instructions: 'You are a helpful assistant that can remember things when asked.',
        description: 'Agent that can use working memory',
        model: openai('gpt-4o'),
        memory,
      });

      // Create the network orchestrator agent
      const networkAgent = new Agent({
        id: 'network-orchestrator',
        name: 'network-orchestrator',
        instructions: 'You help users and can remember things when they ask you to.',
        model: openai('gpt-4o'),
        agents: {
          memoryAgent,
        },
        memory,
      });

      const threadId = randomUUID();
      const result = await networkAgent.network('Please remember that my name is Goku', {
        memory: {
          thread: threadId,
          resource: resourceId,
        },
      });

      // Consume the stream
      const chunks = [];
      for await (const chunk of result) {
        chunks.push(chunk);
        if (chunk.type?.includes('error')) {
          console.log('Error chunk:', chunk);
        }
      }

      // Verify the working memory was updated
      const workingMemory = await memory.getWorkingMemory({ threadId, resourceId });
      expect(workingMemory).toBeTruthy();
      expect(workingMemory).toContain('Goku');
    });

    it('should handle working memory tools in agent network - resource scope', async () => {
      // Create memory instance with resource-scoped working memory
      const resourceMemory = new Memory({
        options: {
          workingMemory: {
            enabled: true,
            scope: 'resource', // Test with resource scope
          },
          lastMessages: 10,
        },
        storage,
        vector,
        embedder: fastembed,
      });

      // Create an agent that has memory capabilities
      const memoryAgent = new Agent({
        name: 'memory-agent',
        instructions: 'You are a helpful assistant that can remember things when asked.',
        description: 'Agent that can use working memory',
        model: openai('gpt-4o'),
        memory: resourceMemory,
      });

      // Create the network orchestrator agent
      const networkAgent = new Agent({
        id: 'network-orchestrator',
        name: 'network-orchestrator',
        instructions: 'You help users and can remember things when they ask you to.',
        model: openai('gpt-4o'),
        agents: {
          memoryAgent,
        },
        memory: resourceMemory,
      });

      // This should trigger the routing agent to select the updateWorkingMemory tool
      const threadId = randomUUID();
      const result = await networkAgent.network('Please remember that my favorite color is blue', {
        memory: {
          thread: threadId,
          resource: resourceId,
        },
      });

      // Consume the stream
      const chunks = [];
      for await (const chunk of result) {
        chunks.push(chunk);
        if (chunk.type?.includes('error')) {
          console.log('Error chunk:', chunk);
        }
      }

      // Verify the working memory was updated
      const workingMemory = await resourceMemory.getWorkingMemory({ threadId, resourceId });
      expect(workingMemory).toBeTruthy();
      // Check for 'blue' case-insensitively since AI might capitalize it
      expect(workingMemory?.toLowerCase()).toContain('blue');
    });
  });

  describe('Experimental vNext updateWorkingMemory Tool', () => {
    it('should handle vNext working memory tool in agent network - thread scope', async () => {
      // Create memory instance with vNext working memory config
      const vNextMemory = new Memory({
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

      // Create an agent that has memory capabilities
      const memoryAgent = new Agent({
        name: 'memory-agent',
        instructions: 'You are a helpful assistant that can remember things when asked.',
        description: 'Agent that can use working memory',
        model: openai('gpt-4o'),
        memory: vNextMemory,
      });

      // Create the network orchestrator agent
      const networkAgent = new Agent({
        id: 'network-orchestrator',
        name: 'network-orchestrator',
        instructions: 'You help users and can remember things when they ask you to.',
        model: openai('gpt-4o'),
        agents: {
          memoryAgent,
        },
        memory: vNextMemory,
      });

      const threadId = randomUUID();
      const result = await networkAgent.network('Please remember that my favorite food is pizza', {
        memory: {
          thread: threadId,
          resource: resourceId,
        },
      });

      // Consume the stream
      const chunks = [];
      for await (const chunk of result) {
        chunks.push(chunk);
        if (chunk.type?.includes('error')) {
          console.log('Error chunk:', chunk);
        }
      }

      // Verify the working memory was updated using the vNext tool
      const workingMemory = await vNextMemory.getWorkingMemory({ threadId, resourceId });
      expect(workingMemory).toBeTruthy();
      expect(workingMemory?.toLowerCase()).toContain('pizza');
    });

    it('should handle vNext working memory tool in agent network - resource scope', async () => {
      // Create memory instance with vNext working memory config and resource scope
      const vNextMemory = new Memory({
        options: {
          workingMemory: {
            enabled: true,
            scope: 'resource', // Test with resource scope
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

      // Create an agent that has memory capabilities
      const memoryAgent = new Agent({
        name: 'memory-agent',
        instructions: 'You are a helpful assistant that can remember things when asked.',
        description: 'Agent that can use working memory',
        model: openai('gpt-4o'),
        memory: vNextMemory,
      });

      // Create the network orchestrator agent
      const networkAgent = new Agent({
        id: 'network-orchestrator',
        name: 'network-orchestrator',
        instructions: 'You help users and can remember things when they ask you to.',
        model: openai('gpt-4o'),
        agents: {
          memoryAgent,
        },
        memory: vNextMemory,
      });

      const threadId = randomUUID();
      const result = await networkAgent.network('Please remember that I live in San Francisco', {
        memory: {
          thread: threadId,
          resource: resourceId,
        },
      });

      // Consume the stream
      const chunks = [];
      for await (const chunk of result) {
        chunks.push(chunk);
        if (chunk.type?.includes('error')) {
          console.log('Error chunk:', chunk);
        }
      }

      // Verify the working memory was updated using the vNext tool with resource scope
      const workingMemory = await vNextMemory.getWorkingMemory({ threadId, resourceId });
      expect(workingMemory).toBeTruthy();
      expect(workingMemory?.toLowerCase()).toContain('san francisco');
    });
  });
});
