import { randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';

const resourceId = 'test-resource';

// Test helpers
const createTestThread = (title: string, metadata = {}) => ({
  id: randomUUID(),
  title,
  resourceId,
  metadata,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('Resource-Scoped Working Memory Tests', () => {
  let memory: Memory;
  let storage: LibSQLStore;

  beforeEach(async () => {
    // Create a new unique database file in the temp directory for each test
    const dbPath = join(await mkdtemp(join(tmpdir(), `memory-resource-working-test-`)), 'test.db');

    storage = new LibSQLStore({
      url: `file:${dbPath}`,
    });

    // Create memory instance with resource-scoped working memory enabled
    memory = new Memory({
      options: {
        workingMemory: {
          enabled: true,
          scope: 'resource',
          template: `# User Information
- **First Name**: 
- **Last Name**: 
- **Location**: 
- **Interests**: 
`,
        },
        lastMessages: 10,
        semanticRecall: false,
        threads: {
          generateTitle: false,
        },
      },
      storage,
    });
  });

  afterEach(async () => {
    //@ts-ignore
    await storage.client.close();
  });

  it('should store working memory at resource level', async () => {
    // Create a thread
    const thread = await memory.saveThread({
      thread: createTestThread('Resource Working Memory Test Thread'),
    });

    // Update working memory using the updateWorkingMemory method
    const workingMemoryData = `# User Information
- **First Name**: John
- **Last Name**: Doe
- **Location**: New York
- **Interests**: AI, Machine Learning
`;

    await memory.updateWorkingMemory({
      threadId: thread.id,
      resourceId,
      workingMemory: workingMemoryData,
    });

    // Get working memory and verify it's stored at resource level
    const retrievedWorkingMemory = await memory.getWorkingMemory({
      threadId: thread.id,
      resourceId,
    });

    expect(retrievedWorkingMemory).toBe(workingMemoryData);
  });

  it('should share working memory across multiple threads for the same resource', async () => {
    // Create two threads for the same resource
    const thread1 = await memory.saveThread({
      thread: createTestThread('First Thread'),
    });

    const thread2 = await memory.saveThread({
      thread: createTestThread('Second Thread'),
    });

    // Update working memory from first thread
    const workingMemoryData = `# User Information
- **First Name**: Alice
- **Last Name**: Smith
- **Location**: California
- **Interests**: Data Science, Python
`;

    await memory.updateWorkingMemory({
      threadId: thread1.id,
      resourceId,
      workingMemory: workingMemoryData,
    });

    // Retrieve working memory from second thread
    const retrievedFromThread2 = await memory.getWorkingMemory({
      threadId: thread2.id,
      resourceId,
    });

    expect(retrievedFromThread2).toBe(workingMemoryData);
  });

  it('should update working memory across all threads when updated from any thread', async () => {
    // Create multiple threads for the same resource
    const thread1 = await memory.saveThread({
      thread: createTestThread('First Thread'),
    });
    const thread2 = await memory.saveThread({
      thread: createTestThread('Second Thread'),
    });
    const thread3 = await memory.saveThread({
      thread: createTestThread('Third Thread'),
    });

    // Set initial working memory from thread1
    const initialWorkingMemory = `# User Information
- **First Name**: Bob
- **Last Name**: Johnson
- **Location**: Texas
- **Interests**: Software Development
`;

    await memory.updateWorkingMemory({
      threadId: thread1.id,
      resourceId,
      workingMemory: initialWorkingMemory,
    });

    // Update working memory from thread2
    const updatedWorkingMemory = `# User Information
- **First Name**: Bob
- **Last Name**: Johnson
- **Location**: Florida
- **Interests**: Software Development, Travel
`;

    await memory.updateWorkingMemory({
      threadId: thread2.id,
      resourceId,
      workingMemory: updatedWorkingMemory,
    });

    // Verify all threads see the updated working memory
    const wmFromThread1 = await memory.getWorkingMemory({ threadId: thread1.id, resourceId });
    const wmFromThread2 = await memory.getWorkingMemory({ threadId: thread2.id, resourceId });
    const wmFromThread3 = await memory.getWorkingMemory({ threadId: thread3.id, resourceId });

    expect(wmFromThread1).toBe(updatedWorkingMemory);
    expect(wmFromThread2).toBe(updatedWorkingMemory);
    expect(wmFromThread3).toBe(updatedWorkingMemory);
  });

  it('should handle basic format for resource-scoped working memory', async () => {
    const thread = await memory.saveThread({
      thread: createTestThread('Format Test Thread'),
    });

    const workingMemoryData = `# User Information
- **First Name**: Charlie
- **Last Name**: 
- **Location**: Seattle
- **Interests**: Technology`;

    await memory.updateWorkingMemory({
      threadId: thread.id,
      resourceId,
      workingMemory: workingMemoryData,
    });

    // Test default format retrieval
    const retrievedDefault = await memory.getWorkingMemory({
      threadId: thread.id,
      resourceId,
    });

    expect(retrievedDefault).toBe(workingMemoryData);
  });

  it('should verify LibSQL storage adapter supports resource working memory', async () => {
    expect(storage.supports.resourceWorkingMemory).toBe(true);
  });

  it('should initialize working memory when creating new threads for existing resources', async () => {
    // Create first thread and set working memory
    const thread1 = await memory.saveThread({
      thread: createTestThread('First Thread'),
    });

    const workingMemoryData = `# User Information
- **First Name**: David
- **Last Name**: Wilson
- **Location**: Portland
- **Interests**: Music, Photography
`;

    await memory.updateWorkingMemory({
      threadId: thread1.id,
      resourceId,
      workingMemory: workingMemoryData,
    });

    // Create a new thread for the same resource
    const thread2 = await memory.saveThread({
      thread: createTestThread('Second Thread'),
    });

    // The new thread should immediately have access to the existing working memory
    const retrievedMemory = await memory.getWorkingMemory({
      threadId: thread2.id,
      resourceId,
    });

    expect(retrievedMemory).toBe(workingMemoryData);
  });
});
