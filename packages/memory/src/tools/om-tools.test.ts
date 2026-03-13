import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, it, expect, beforeEach } from 'vitest';

import { Memory } from '../index';
import { recallMessages, recallTool } from './om-tools';

describe('om-tools', () => {
  describe('recallMessages', () => {
    let memory: Memory;
    const threadId = 'thread-om-tools';
    const resourceId = 'resource-om-tools';
    let messages: MastraDBMessage[];

    beforeEach(async () => {
      memory = new Memory({ storage: new InMemoryStore() });

      await memory.saveThread({
        thread: {
          id: threadId,
          resourceId,
          title: 'OM tool test thread',
          createdAt: new Date('2024-01-01T10:00:00Z'),
          updatedAt: new Date('2024-01-01T10:00:00Z'),
        },
      });

      messages = [
        {
          id: 'msg-1',
          threadId,
          resourceId,
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Message 1' }] },
          createdAt: new Date('2024-01-01T10:00:00Z'),
        },
        {
          id: 'msg-2',
          threadId,
          resourceId,
          role: 'assistant',
          content: { format: 2, parts: [{ type: 'text', text: 'Message 2' }] },
          createdAt: new Date('2024-01-01T10:01:00Z'),
        },
        {
          id: 'msg-3',
          threadId,
          resourceId,
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Message 3' }] },
          createdAt: new Date('2024-01-01T10:02:00Z'),
        },
        {
          id: 'msg-4',
          threadId,
          resourceId,
          role: 'assistant',
          content: { format: 2, parts: [{ type: 'text', text: 'Message 4' }] },
          createdAt: new Date('2024-01-01T10:03:00Z'),
        },
        {
          id: 'msg-5',
          threadId,
          resourceId,
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Message 5' }] },
          createdAt: new Date('2024-01-01T10:04:00Z'),
        },
      ];

      await memory.saveMessages({ messages });
    });

    it('should return forward results from a cursor', async () => {
      const result = await recallMessages({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'msg-2',
        page: 1,
        limit: 2,
      });

      expect(result.count).toBe(2);
      expect(result.cursor).toBe('msg-2');
      expect(result.page).toBe(1);
      expect(result.limit).toBe(2);
      expect(result.messages).toContain('Message 3');
      expect(result.messages).toContain('Message 4');
      expect(result.messages).not.toContain('Message 5');
    });

    it('should return backward results when page is negative', async () => {
      const result = await recallMessages({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'msg-4',
        page: -1,
        limit: 2,
      });

      expect(result.count).toBe(2);
      expect(result.page).toBe(-1);
      expect(result.messages).toContain('Message 2');
      expect(result.messages).toContain('Message 3');
      expect(result.messages).not.toContain('Message 1');
    });

    it('should treat page 0 as page 1', async () => {
      const result = await recallMessages({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'msg-2',
        page: 0,
        limit: 1,
      });

      expect(result.page).toBe(1);
      expect(result.count).toBe(1);
      expect(result.messages).toContain('Message 3');
    });

    it('should use the default limit of 20', async () => {
      const result = await recallMessages({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'msg-1',
      });

      expect(result.limit).toBe(20);
      expect(result.count).toBe(4);
      expect(result.messages).toContain('Message 2');
      expect(result.messages).toContain('Message 5');
    });

    it('should reject cursors from a different thread', async () => {
      await memory.saveThread({
        thread: {
          id: 'other-thread',
          resourceId,
          title: 'Other thread',
          createdAt: new Date('2024-01-01T11:00:00Z'),
          updatedAt: new Date('2024-01-01T11:00:00Z'),
        },
      });

      await memory.saveMessages({
        messages: [
          {
            id: 'other-1',
            threadId: 'other-thread',
            resourceId,
            role: 'user',
            content: { format: 2, parts: [{ type: 'text', text: 'Wrong thread' }] },
            createdAt: new Date('2024-01-01T11:00:00Z'),
          },
        ],
      });

      await expect(
        recallMessages({
          memory: memory as any,
          threadId,
          resourceId,
          cursor: 'other-1',
        }),
      ).rejects.toThrow('does not belong to the current thread');
    });

    it('should surface missing memory context errors from the tool', async () => {
      const tool = recallTool();

      await expect(tool.execute?.({ cursor: 'msg-2' }, { agent: { threadId, resourceId } } as any)).rejects.toThrow(
        'Memory instance is required for recall',
      );
    });
  });

  describe('Memory.listTools', () => {
    it('should register recall only when OM graph mode is enabled', () => {
      const graphMemory = new Memory({
        storage: new InMemoryStore(),
        options: {
          observationalMemory: {
            model: 'test-model',
            graph: true,
          },
        } as any,
      });

      const nonGraphMemory = new Memory({
        storage: new InMemoryStore(),
        options: {
          observationalMemory: {
            model: 'test-model',
            graph: false,
          },
        } as any,
      });

      expect(graphMemory.listTools()).toHaveProperty('recall');
      expect(nonGraphMemory.listTools()).not.toHaveProperty('recall');
    });
  });
});
