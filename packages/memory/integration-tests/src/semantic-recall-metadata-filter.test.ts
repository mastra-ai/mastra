import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { LibSQLVector } from '@mastra/libsql';
import { fastembed } from '@mastra/fastembed';
import { mkdtemp } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Semantic Recall with Metadata Filtering', () => {
  let memory: Memory;
  let storage: LibSQLStore;
  let vector: LibSQLVector;
  let resourceId: string;

  beforeEach(async () => {
    // Create a new unique database file for each test
    const dbPath = join(await mkdtemp(join(tmpdir(), `memory-metadata-filter-test-`)), 'test.db');
    
    storage = new LibSQLStore({
      url: `file:${dbPath}`,
    });
    
    vector = new LibSQLVector({
      connectionUrl: `file:${dbPath}`,
    });

    // Create memory instance with semantic recall and metadata filtering
    memory = new Memory({
      options: {
        lastMessages: 5,
        semanticRecall: {
          topK: 5,
          messageRange: 2,
          scope: 'resource',
        },
      },
      storage,
      vector,
      embedder: fastembed,
    });

    resourceId = 'test-resource-metadata-filter';
  });

  afterEach(async () => {
    try {
      await storage.client.close();
      await vector.turso.close();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should filter messages by projectId metadata in semantic recall', async () => {
    const projectA = 'project-a';
    const projectB = 'project-b';

    // Create thread 1 with project A
    const thread1 = await memory.saveThread({
      thread: {
        id: 'thread-1',
        metadata: { projectId: projectA }
      }
    });

    // Add messages to thread 1
    await memory.saveMessages({
      messages: [
        {
          id: 'msg-1',
          threadId: thread1.id,
          role: 'user',
          content: 'Tell me about cats and their behavior patterns',
          metadata: { projectId: projectA }
        },
        {
          id: 'msg-2',
          threadId: thread1.id,
          role: 'assistant',
          content: 'Cats are independent animals that sleep 12-16 hours a day and are very playful hunters.',
          metadata: { projectId: projectA }
        }
      ]
    });

    // Create thread 2 with project B
    const thread2 = await memory.saveThread({
      thread: {
        id: 'thread-2',
        metadata: { projectId: projectB }
      }
    });

    // Add messages to thread 2
    await memory.saveMessages({
      messages: [
        {
          id: 'msg-3',
          threadId: thread2.id,
          role: 'user',
          content: 'Tell me about dogs and their behavior patterns',
          metadata: { projectId: projectB }
        },
        {
          id: 'msg-4',
          threadId: thread2.id,
          role: 'assistant',
          content: 'Dogs are loyal companions that love to play fetch and need regular exercise.',
          metadata: { projectId: projectB }
        }
      ]
    });

    // Test semantic recall with project A filter
    const resultA = await memory.rememberMessages({
      threadId: 'new-thread',
      resourceId,
      vectorMessageSearch: 'Tell me about animal behavior and sleep patterns',
      config: {
        lastMessages: 0,
        semanticRecall: {
          topK: 5,
          messageRange: 1,
          scope: 'resource',
          filter: {
            projectId: { $eq: projectA }
          }
        }
      }
    });

    // Verify only project A messages are returned
    const projectAMessages = resultA.messages.filter(m => m.metadata?.projectId === projectA);
    const projectBMessages = resultA.messages.filter(m => m.metadata?.projectId === projectB);

    expect(projectAMessages.length).toBeGreaterThan(0);
    expect(projectBMessages.length).toBe(0);
    expect(resultA.messages.length).toBe(projectAMessages.length);

    // Test semantic recall with project B filter
    const resultB = await memory.rememberMessages({
      threadId: 'new-thread-2',
      resourceId,
      vectorMessageSearch: 'Tell me about animal behavior and exercise needs',
      config: {
        lastMessages: 0,
        semanticRecall: {
          topK: 5,
          messageRange: 1,
          scope: 'resource',
          filter: {
            projectId: { $eq: projectB }
          }
        }
      }
    });

    // Verify only project B messages are returned
    const projectAMessagesB = resultB.messages.filter(m => m.metadata?.projectId === projectA);
    const projectBMessagesB = resultB.messages.filter(m => m.metadata?.projectId === projectB);

    expect(projectBMessagesB.length).toBeGreaterThan(0);
    expect(projectAMessagesB.length).toBe(0);
    expect(resultB.messages.length).toBe(projectBMessagesB.length);
  });

  it('should support complex metadata filters with multiple conditions', async () => {
    // Create threads with different metadata
    const thread1 = await memory.saveThread({
      thread: {
        id: 'thread-1',
        metadata: { projectId: 'project-a', category: 'work', priority: 'high' }
      }
    });

    const thread2 = await memory.saveThread({
      thread: {
        id: 'thread-2',
        metadata: { projectId: 'project-a', category: 'personal', priority: 'low' }
      }
    });

    const thread3 = await memory.saveThread({
      thread: {
        id: 'thread-3',
        metadata: { projectId: 'project-b', category: 'work', priority: 'high' }
      }
    });

    // Add messages to each thread
    await memory.saveMessages({
      messages: [
        {
          id: 'msg-1',
          threadId: thread1.id,
          role: 'user',
          content: 'Work task: Review the quarterly reports',
          metadata: { projectId: 'project-a', category: 'work', priority: 'high' }
        },
        {
          id: 'msg-2',
          threadId: thread2.id,
          role: 'user',
          content: 'Personal note: Remember to call mom',
          metadata: { projectId: 'project-a', category: 'personal', priority: 'low' }
        },
        {
          id: 'msg-3',
          threadId: thread3.id,
          role: 'user',
          content: 'Another work task: Update the database',
          metadata: { projectId: 'project-b', category: 'work', priority: 'high' }
        }
      ]
    });

    // Test complex filter: project-a AND work category
    const result = await memory.rememberMessages({
      threadId: 'new-thread',
      resourceId,
      vectorMessageSearch: 'Tell me about work tasks and reports',
      config: {
        lastMessages: 0,
        semanticRecall: {
          topK: 5,
          messageRange: 1,
          scope: 'resource',
          filter: {
            $and: [
              { projectId: { $eq: 'project-a' } },
              { category: { $eq: 'work' } }
            ]
          }
        }
      }
    });

    // Should only return messages from project-a with work category
    const workMessages = result.messages.filter(m => 
      m.metadata?.projectId === 'project-a' && m.metadata?.category === 'work'
    );
    const personalMessages = result.messages.filter(m => 
      m.metadata?.category === 'personal'
    );
    const projectBMessages = result.messages.filter(m => 
      m.metadata?.projectId === 'project-b'
    );

    expect(workMessages.length).toBeGreaterThan(0);
    expect(personalMessages.length).toBe(0);
    expect(projectBMessages.length).toBe(0);
  });

  it('should work with $in operator for multiple project IDs', async () => {
    // Create threads with different project IDs
    const projects = ['project-a', 'project-b', 'project-c'];
    
    for (let i = 0; i < projects.length; i++) {
      const thread = await memory.saveThread({
        thread: {
          id: `thread-${i}`,
          metadata: { projectId: projects[i] }
        }
      });

      await memory.saveMessages({
        messages: [
          {
            id: `msg-${i}`,
            threadId: thread.id,
            role: 'user',
            content: `Message from ${projects[i]}: Important information about project ${i + 1}`,
            metadata: { projectId: projects[i] }
          }
        ]
      });
    }

    // Test filter with $in operator for project-a and project-b
    const result = await memory.rememberMessages({
      threadId: 'new-thread',
      resourceId,
      vectorMessageSearch: 'Tell me about important project information',
      config: {
        lastMessages: 0,
        semanticRecall: {
          topK: 5,
          messageRange: 1,
          scope: 'resource',
          filter: {
            projectId: { $in: ['project-a', 'project-b'] }
          }
        }
      }
    });

    // Should only return messages from project-a and project-b
    const filteredMessages = result.messages.filter(m => 
      m.metadata?.projectId === 'project-a' || m.metadata?.projectId === 'project-b'
    );
    const projectCMessages = result.messages.filter(m => 
      m.metadata?.projectId === 'project-c'
    );

    expect(filteredMessages.length).toBeGreaterThan(0);
    expect(projectCMessages.length).toBe(0);
    expect(result.messages.length).toBe(filteredMessages.length);
  });
});

