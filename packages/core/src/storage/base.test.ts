import { describe, expect, it, beforeEach } from 'vitest';

import { MessageType, ThreadType } from '../memory';
import { WorkflowRunState } from '../workflows';

import { MastraStorageInMemory } from './in-memory';

describe('MastraStorageBase', () => {
  let storage: MastraStorageInMemory;

  beforeEach(() => {
    storage = new MastraStorageInMemory();
  });

  describe('Workflow Storage', () => {
    it('should initialize tables', async () => {
      await storage.init();
      await expect(
        storage.loadWorkflowSnapshot({
          workflowName: 'test',
          runId: '123',
        }),
      ).resolves.toBeNull();
    });

    it('should persist and load workflow snapshots', async () => {
      await storage.init();

      const testSnapshot: WorkflowRunState = {
        value: { state: 'completed' },
        context: {
          stepResults: {},
          triggerData: {},
          attempts: {},
        },
        activePaths: [
          {
            stepPath: ['initial'],
            stepId: 'initial',
            status: 'completed',
          },
        ],
        runId: 'test-run-1',
        timestamp: Date.now(),
      };

      await storage.persistWorkflowSnapshot({
        workflowName: 'test-workflow',
        runId: testSnapshot.runId,
        snapshot: testSnapshot,
      });

      const loaded = await storage.loadWorkflowSnapshot({
        workflowName: 'test-workflow',
        runId: testSnapshot.runId,
      });

      console.log(loaded);

      expect(loaded).toBeDefined();
      expect(loaded).toEqual(expect.objectContaining(testSnapshot));
    });
  });

  describe('Thread Management', () => {
    it('should create and retrieve threads', async () => {
      const thread: ThreadType = {
        id: 'thread-1',
        title: 'Test Thread',
        resource_id: 'resource-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          resource_id: 'resource-1',
        },
      };

      await storage.saveThread({ thread });
      const retrieved = await storage.getThreadById({ threadId: thread.id });
      expect(retrieved).toEqual(thread);
    });

    it('should update thread metadata', async () => {
      const thread: ThreadType = {
        id: 'thread-2',
        title: 'Original Title',
        resource_id: 'resource-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          resource_id: 'resource-1',
        },
      };

      await storage.saveThread({ thread });

      const updatedThread = await storage.updateThread({
        id: thread.id,
        title: 'Updated Title',
        metadata: {
          resource_id: 'resource-1',
          newField: 'value',
        },
      });

      expect(updatedThread.title).toBe('Updated Title');
      expect(updatedThread.metadata).toEqual({
        resource_id: 'resource-1',
        newField: 'value',
      });
    });

    it('should retrieve threads by resource id', async () => {
      const threads: ThreadType[] = [
        {
          id: 'thread-3',
          title: 'Thread 3',
          resource_id: 'resource-2',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: { resource_id: 'resource-2' },
        },
        {
          id: 'thread-4',
          title: 'Thread 4',
          resource_id: 'resource-2',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: { resource_id: 'resource-2' },
        },
        {
          id: 'thread-5',
          title: 'Thread 5',
          resource_id: 'resource-3',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: { resource_id: 'resource-3' },
        },
      ];

      await Promise.all(threads.map(thread => storage.saveThread({ thread })));

      const resource2Threads = await storage.getThreadsByResourceId({ resource_id: 'resource-2' });
      expect(resource2Threads).toHaveLength(2);
      expect(resource2Threads.map(t => t.id)).toEqual(['thread-3', 'thread-4']);
    });
  });

  describe('Message Management', () => {
    it('should save and retrieve messages', async () => {
      const messages: MessageType[] = [
        {
          id: 'message-6-1',
          createdAt: new Date(),
          type: 'text',
          threadId: 'thread-6',
          content: 'Message 1',
          role: 'user',
        },
        {
          id: 'message-6-2',
          createdAt: new Date(),
          threadId: 'thread-6',
          type: 'text',
          content: 'Message 2',
          role: 'assistant',
        },
      ];

      await storage.saveMessages({ messages });
      const retrieved = await storage.getMessages<MessageType[]>({ threadId: 'thread-6' });

      expect(retrieved).toHaveLength(2);
      expect(retrieved[0].content).toBe('Message 1');
      expect(retrieved[1].content).toBe('Message 2');
    });

    it('should append new messages to existing thread', async () => {
      const initialMessage: MessageType = {
        id: 'message-7-1',
        createdAt: new Date(),
        threadId: 'thread-7',
        content: 'Initial Message',
        role: 'user',
        type: 'text',
      };
      await storage.saveMessages({ messages: [initialMessage] });

      const newMessage: MessageType = {
        id: 'message-7-2',
        createdAt: new Date(),
        threadId: 'thread-7',
        content: 'New Message',
        role: 'assistant',
        type: 'text',
      };

      await storage.saveMessages({ messages: [newMessage] });

      const allMessages = await storage.getMessages<MessageType[]>({ threadId: 'thread-7' });
      expect(allMessages).toHaveLength(2);
      expect(allMessages[0].content).toBe('Initial Message');
      expect(allMessages[1].content).toBe('New Message');
    });

    it('should handle message deletion when thread is deleted', async () => {
      const thread: ThreadType = {
        id: 'thread-8',
        title: 'Thread to Delete',
        resource_id: 'resource-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
      };

      const message: MessageType = {
        threadId: 'thread-8',
        content: 'Message to Delete',
        role: 'user',
        id: 'message-8-1',
        createdAt: new Date(),
        type: 'text',
      };

      await storage.saveThread({ thread });
      await storage.saveMessages({ messages: [message] });

      await storage.deleteThread({ id: 'thread-8' });

      const messages = await storage.getMessages<MessageType[]>({ threadId: 'thread-8' });
      expect(messages).toHaveLength(0);
    });
  });
});
