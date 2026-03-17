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

    it('should list forward results from a cursor by default', async () => {
      const result = await recallMessages({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'msg-2',
        page: 1,
        limit: 2,
      });

      expect(result.mode).toBe('list');
      if (result.mode !== 'list') throw new Error('Expected list mode');
      expect(result.count).toBe(2);
      expect(result.cursor).toBe('msg-2');
      expect(result.page).toBe(1);
      expect(result.limit).toBe(2);
      expect(result.direction).toBe('forward');
      expect(result.items.map(item => item.id)).toEqual(['msg-3', 'msg-4']);
      expect(result.items.map(item => item.preview)).toEqual(['Message 3', 'Message 4']);
      expect(result.hasMore).toBe(true);
    });

    it('should list backward results when page is negative', async () => {
      const result = await recallMessages({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'msg-4',
        page: -1,
        limit: 2,
      });

      expect(result.mode).toBe('list');
      if (result.mode !== 'list') throw new Error('Expected list mode');
      expect(result.count).toBe(2);
      expect(result.page).toBe(-1);
      expect(result.direction).toBe('backward');
      expect(result.items.map(item => item.id)).toEqual(['msg-2', 'msg-3']);
      expect(result.hasMore).toBe(true);
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

      expect(result.mode).toBe('list');
      if (result.mode !== 'list') throw new Error('Expected list mode');
      expect(result.page).toBe(1);
      expect(result.count).toBe(1);
      expect(result.items.map(item => item.id)).toEqual(['msg-3']);
    });

    it('should use the default limit of 20 in list mode', async () => {
      const result = await recallMessages({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'msg-1',
      });

      expect(result.mode).toBe('list');
      if (result.mode !== 'list') throw new Error('Expected list mode');
      expect(result.limit).toBe(20);
      expect(result.count).toBe(4);
      expect(result.items.map(item => item.id)).toEqual(['msg-2', 'msg-3', 'msg-4', 'msg-5']);
      expect(result.hasMore).toBe(false);
    });

    it('should inspect the listed window when mode is inspect', async () => {
      const result = await recallMessages({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'msg-2',
        page: 1,
        limit: 2,
        mode: 'inspect',
      });

      expect(result.mode).toBe('inspect');
      if (result.mode !== 'inspect') throw new Error('Expected inspect mode');
      expect(result.count).toBe(2);
      expect(result.items.map(item => item.id)).toEqual(['msg-3', 'msg-4']);
      expect(result.messages).toContain('Message 3');
      expect(result.messages).toContain('Message 4');
    });

    it('should inspect explicit message ids in chronological order', async () => {
      const result = await recallMessages({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'msg-2',
        mode: 'inspect',
        messageIds: ['msg-5', 'msg-3'],
      });

      expect(result.mode).toBe('inspect');
      if (result.mode !== 'inspect') throw new Error('Expected inspect mode');
      expect(result.inspectedIds).toEqual(['msg-5', 'msg-3']);
      expect(result.items.map(item => item.id)).toEqual(['msg-3', 'msg-5']);
      expect(result.messages).toContain('Message 3');
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

    it('should reject inspected ids from a different thread', async () => {
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
            role: 'assistant',
            content: { format: 2, parts: [{ type: 'text', text: 'Wrong thread detail' }] },
            createdAt: new Date('2024-01-01T11:01:00Z'),
          },
        ],
      });

      await expect(
        recallMessages({
          memory: memory as any,
          threadId,
          resourceId,
          cursor: 'msg-2',
          mode: 'inspect',
          messageIds: ['msg-3', 'other-1'],
        }),
      ).rejects.toThrow('do not belong to the current thread');
    });

    it('should surface missing memory context errors from the tool', async () => {
      const tool = recallTool();

      await expect(tool.execute?.({ cursor: 'msg-2' }, { agent: { threadId, resourceId } } as any)).rejects.toThrow(
        'Memory instance is required for recall',
      );
    });
  });

  describe('Memory.listTools', () => {
    it('should register recall when observational memory graph mode is enabled', () => {
      const memory = new Memory({
        storage: new InMemoryStore(),
        options: {
          observationalMemory: {
            model: 'google/gemini-2.5-flash',
            graph: true,
          } as any,
        },
      });

      const tools = memory.listTools();
      expect(tools.recall).toBeDefined();
    });

    it('should not register recall when graph mode is disabled', () => {
      const memory = new Memory({
        storage: new InMemoryStore(),
        options: {
          observationalMemory: {
            model: 'google/gemini-2.5-flash',
            graph: false,
          } as any,
        },
      });

      const tools = memory.listTools();
      expect(tools.recall).toBeUndefined();
    });
  });
});
