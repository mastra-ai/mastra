import { randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { WorkingMemoryProcessor } from '@mastra/core/processors';
import { fastembed } from '@mastra/fastembed';
import { LibSQLVector, LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { config } from 'dotenv';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';

config({ path: '.env.test' });

const resourceId = 'test-resource';

describe('WorkingMemoryProcessor Integration Tests', () => {
  let memory: Memory;
  let storage: LibSQLStore;
  let vector: LibSQLVector;
  let processor: WorkingMemoryProcessor;
  let agent: Agent;

  beforeEach(async () => {
    // Create a new unique database file in the temp directory for each test
    const dbPath = join(await mkdtemp(join(tmpdir(), `wm-processor-test-${Date.now()}`)), 'test.db');
    console.log('Test DB Path:', dbPath);

    storage = new LibSQLStore({
      url: `file:${dbPath}`,
    });

    vector = new LibSQLVector({
      connectionUrl: `file:${dbPath}`,
    });

    // Create memory instance WITHOUT built-in working memory (we'll use the processor)
    memory = new Memory({
      options: {
        workingMemory: {
          enabled: false, // Disable built-in working memory
        },
        lastMessages: 10,
        semanticRecall: {
          topK: 3,
          messageRange: 2,
        },
        threads: {
          generateTitle: false,
        },
      },
      storage,
      vector,
      embedder: fastembed,
    });

    // Create the WorkingMemoryProcessor with resource scope (default)
    processor = new WorkingMemoryProcessor({
      storage: storage as any, // Cast to MastraStorage
      model: openai('gpt-4o-mini'),
      scope: 'resource',
      template: {
        format: 'markdown',
        content: `# User Information
- **Name**:
- **Location**:
- **Preferences**:
`,
      },
      extractFromUserMessages: true,
      injectionStrategy: 'system',
      includeReasoning: true,
    });

    // Create agent with the working memory processor
    agent = new Agent({
      name: 'Memory Test Agent',
      instructions: 'You are a helpful assistant. Be friendly and conversational.',
      model: openai('gpt-4o-mini'),
      memory,
      inputProcessors: [processor],
      outputProcessors: [processor],
    });
  });

  afterEach(async () => {
    //@ts-ignore
    await storage.client?.close();
    //@ts-ignore
    await vector.turso?.close();
  });

  it('should remember user name introduced in first message', async () => {
    console.log('\n=== Test: Remember User Name ===');

    // Create a thread
    const thread = await memory.createThread({
      title: 'Name Test Thread',
      resourceId,
      metadata: {},
    });

    console.log('Thread created:', thread.id);

    // First conversation - user introduces themselves
    console.log('\n1. User introduces themselves...');

    const response1 = await agent.generateLegacy('Hello, my name is Daniel', {
      threadId: thread.id,
      resourceId,
    });

    console.log('Agent response 1:', response1.text);

    // Wait a bit for async operations to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check that working memory was updated with the name
    const resourceData = await storage.stores?.memory?.getResourceById({ resourceId });
    console.log('Resource working memory:', resourceData?.workingMemory);

    expect(resourceData?.workingMemory).toBeDefined();
    expect(resourceData?.workingMemory).toContain('Daniel');

    // Second conversation - ask about the name
    console.log('\n2. User asks about their name...');
    const response2 = await agent.generateLegacy('What is my name?', {
      threadId: thread.id,
      resourceId,
    });

    console.log('Agent response 2:', response2.text);

    // The agent should know the name from working memory
    expect(response2.text.toLowerCase()).toContain('daniel');
  });

  it('should accumulate information across multiple conversations', async () => {
    console.log('\n=== Test: Accumulate Information ===');

    const thread = await memory.createThread({
      title: 'Multi-turn Test',
      resourceId,
      metadata: {},
    });

    // Turn 1: Name
    console.log('\n1. Providing name...');
    await agent.generateLegacy('My name is Alice', {
      threadId: thread.id,
      resourceId,
    });

    let resourceData = await storage.stores?.memory?.getResourceById({ resourceId });
    console.log('After name:', resourceData?.workingMemory);
    expect(resourceData?.workingMemory).toContain('Alice');

    // Turn 2: Location
    console.log('\n2. Providing location...');
    await agent.generateLegacy('I live in San Francisco', {
      threadId: thread.id,
      resourceId,
    });

    resourceData = await storage.stores?.memory?.getResourceById({ resourceId });
    console.log('After location:', resourceData?.workingMemory);
    expect(resourceData?.workingMemory).toContain('Alice');
    expect(resourceData?.workingMemory).toContain('San Francisco');

    // Turn 3: Preferences
    console.log('\n3. Providing preferences...');
    await agent.generateLegacy('I love TypeScript and dark mode', {
      threadId: thread.id,
      resourceId,
    });

    resourceData = await storage.stores?.memory?.getResourceById({ resourceId });
    console.log('After preferences:', resourceData?.workingMemory);
    expect(resourceData?.workingMemory).toContain('Alice');
    expect(resourceData?.workingMemory).toContain('San Francisco');
    expect(resourceData?.workingMemory).toContain('TypeScript');

    // Turn 4: Ask for summary
    console.log('\n4. Asking for summary...');
    const summaryResponse = await agent.generateLegacy('Can you tell me everything you remember about me?', {
      threadId: thread.id,
      resourceId,
    });

    console.log('Summary response:', summaryResponse.text);

    // Should mention all accumulated information
    expect(summaryResponse.text.toLowerCase()).toContain('alice');
    expect(summaryResponse.text.toLowerCase()).toContain('san francisco');
    expect(summaryResponse.text.toLowerCase()).toContain('typescript');
  });

  it('should maintain separate memory for different resources', async () => {
    console.log('\n=== Test: Separate Resource Memory ===');

    const resource1 = randomUUID();
    const resource2 = randomUUID();

    // Create threads for each resource
    const thread1 = await memory.createThread({
      title: 'Resource 1 Thread',
      resourceId: resource1,
      metadata: {},
    });

    const thread2 = await memory.createThread({
      title: 'Resource 2 Thread',
      resourceId: resource2,
      metadata: {},
    });

    // Conversation in resource 1
    console.log('\n1. Resource 1 conversation...');
    await agent.generateLegacy('I am Bob and I like JavaScript', {
      threadId: thread1.id,
      resourceId: resource1,
    });

    // Conversation in resource 2
    console.log('\n2. Resource 2 conversation...');
    await agent.generateLegacy('I am Charlie and I like Python', {
      threadId: thread2.id,
      resourceId: resource2,
    });

    // Check memories are separate
    const memory1 = await storage.stores?.memory?.getResourceById({ resourceId: resource1 });
    const memory2 = await storage.stores?.memory?.getResourceById({ resourceId: resource2 });

    console.log('Resource 1 memory:', memory1?.workingMemory);
    console.log('Resource 2 memory:', memory2?.workingMemory);

    // Resource 1 should only have Bob's info
    expect(memory1?.workingMemory).toContain('Bob');
    expect(memory1?.workingMemory).toContain('JavaScript');
    expect(memory1?.workingMemory).not.toContain('Charlie');
    expect(memory1?.workingMemory).not.toContain('Python');

    // Resource 2 should only have Charlie's info
    expect(memory2?.workingMemory).toContain('Charlie');
    expect(memory2?.workingMemory).toContain('Python');
    expect(memory2?.workingMemory).not.toContain('Bob');
    expect(memory2?.workingMemory).not.toContain('JavaScript');

    // Ask about name in each context
    console.log('\n3. Asking for name in resource 1...');
    const query1 = await agent.generateLegacy('What is my name and what do I like?', {
      threadId: thread1.id,
      resourceId: resource1,
    });
    console.log('Resource 1 query response:', query1.text);
    expect(query1.text.toLowerCase()).toContain('bob');
    expect(query1.text.toLowerCase()).toContain('javascript');

    console.log('\n4. Asking for name in resource 2...');
    const query2 = await agent.generateLegacy('What is my name and what do I like?', {
      threadId: thread2.id,
      resourceId: resource2,
    });
    console.log('Resource 2 query response:', query2.text);
    expect(query2.text.toLowerCase()).toContain('charlie');
    expect(query2.text.toLowerCase()).toContain('python');
  });

  it('should work with thread-scoped memory when configured', async () => {
    console.log('\n=== Test: Thread-Scoped Memory ===');

    // Create processor with thread scope
    const threadProcessor = new WorkingMemoryProcessor({
      storage: storage as any,
      model: openai('gpt-4o-mini'),
      scope: 'thread',
      template: {
        format: 'markdown',
        content: `# User Info\n- Name:\n- Preferences:`,
      },
      extractFromUserMessages: true,
    });

    // Create agent with thread-scoped processor
    const threadAgent = new Agent({
      name: 'Thread Memory Agent',
      instructions: 'You are a helpful assistant.',
      model: openai('gpt-4o-mini'),
      memory,
      inputProcessors: [threadProcessor],
      outputProcessors: [threadProcessor],
    });

    // Create two threads for the same resource
    const thread1 = await memory.createThread({
      title: 'Thread 1',
      resourceId,
      metadata: {},
    });

    const thread2 = await memory.createThread({
      title: 'Thread 2',
      resourceId,
      metadata: {},
    });

    // Conversation in thread 1
    console.log('\n1. Thread 1 conversation...');
    await threadAgent.generateLegacy('My name is David and I like Go', {
      threadId: thread1.id,
      resourceId,
    });

    // Conversation in thread 2
    console.log('\n2. Thread 2 conversation...');
    await threadAgent.generateLegacy('My name is Emily and I like Ruby', {
      threadId: thread2.id,
      resourceId,
    });

    // Check thread memories are separate
    const thread1Data = await storage.stores?.memory?.getThreadById({ threadId: thread1.id });
    const thread2Data = await storage.stores?.memory?.getThreadById({ threadId: thread2.id });

    console.log('Thread 1 memory:', thread1Data?.metadata?.workingMemory);
    console.log('Thread 2 memory:', thread2Data?.metadata?.workingMemory);

    // Thread 1 should only have David's info
    expect(thread1Data?.metadata?.workingMemory).toContain('David');
    expect(thread1Data?.metadata?.workingMemory).toContain('Go');
    expect(thread1Data?.metadata?.workingMemory).not.toContain('Emily');

    // Thread 2 should only have Emily's info
    expect(thread2Data?.metadata?.workingMemory).toContain('Emily');
    expect(thread2Data?.metadata?.workingMemory).toContain('Ruby');
    expect(thread2Data?.metadata?.workingMemory).not.toContain('David');

    // Query each thread
    console.log('\n3. Querying thread 1...');
    const response1 = await threadAgent.generateLegacy('What is my name?', {
      threadId: thread1.id,
      resourceId,
    });
    expect(response1.text.toLowerCase()).toContain('david');

    console.log('\n4. Querying thread 2...');
    const response2 = await threadAgent.generateLegacy('What is my name?', {
      threadId: thread2.id,
      resourceId,
    });
    expect(response2.text.toLowerCase()).toContain('emily');
  });

  it('should handle name changes and updates', async () => {
    console.log('\n=== Test: Name Changes ===');

    const thread = await memory.createThread({
      title: 'Name Change Test',
      resourceId,
      metadata: {},
    });

    // Initial name
    console.log('\n1. Setting initial name...');
    await agent.generateLegacy('My name is Tyler', {
      threadId: thread.id,
      resourceId,
    });

    let resourceData = await storage.stores?.memory?.getResourceById({ resourceId });
    console.log('Initial memory:', resourceData?.workingMemory);
    expect(resourceData?.workingMemory).toContain('Tyler');

    // Change name
    console.log('\n2. Changing name...');
    await agent.generateLegacy('Actually, I changed my name to Jim', {
      threadId: thread.id,
      resourceId,
    });

    resourceData = await storage.stores?.memory?.getResourceById({ resourceId });
    console.log('After name change:', resourceData?.workingMemory);
    expect(resourceData?.workingMemory).toContain('Jim');

    // Verify the agent uses the new name
    console.log('\n3. Verifying new name...');
    const response = await agent.generateLegacy('What is my name?', {
      threadId: thread.id,
      resourceId,
    });
    console.log('Name query response:', response.text);
    expect(response.text.toLowerCase()).toContain('jim');
  });

  it('should manually update and retrieve working memory', async () => {
    console.log('\n=== Test: Manual Update ===');

    // Create thread
    const thread = await memory.createThread({
      resourceId: 'test-resource-manual',
    });
    console.log('Thread created:', thread.id);

    // Manually update working memory
    const testMemory = `# User Information
- Name: John Doe
- Location: San Francisco
- Interests: Programming, AI`;

    await processor.manualUpdateWorkingMemory(testMemory, thread.id, 'test-resource-manual');
    console.log('Manually updated working memory');

    // Check if working memory was saved
    const resourceData = await storage.stores?.memory?.getResourceById({
      resourceId: 'test-resource-manual',
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
      resourceId: 'test-resource-injection',
    });

    // Manually set working memory
    const testMemory = `# User Information
- Name: Jane Deer
- Job: Software Engineer`;

    await processor.manualUpdateWorkingMemory(testMemory, thread.id, 'test-resource-injection');
    console.log('Set working memory for Jane Deer');

    // Now ask a question that should use the context
    const response = await agent.generateLegacy('What is my name?', {
      threadId: thread.id,
      resourceId: 'test-resource-injection',
    });

    console.log('Agent response:', response.text);

    // The agent should know the name from working memory
    expect(response.text.toLowerCase()).toContain('jane');
  });

  it('should inject context without errors (basic smoke test)', async () => {
    console.log('\n=== Test: Basic Injection Smoke Test ===');

    // Create thread
    const thread = await memory.createThread({
      resourceId: 'test-resource-smoke',
    });

    // Manually set some working memory using the processor
    const resourceId = 'test-resource-smoke';
    await processor.manualUpdateWorkingMemory('# User Info\n- Name: TestUser', thread.id, resourceId);

    console.log('Set working memory manually');

    // Now try to generate - this should inject the context
    const response = await agent.generateLegacy('Hello', {
      threadId: thread.id,
      resourceId,
    });

    console.log('SUCCESS! Response:', response.text);
    expect(response.text).toBeDefined();
  });
});
