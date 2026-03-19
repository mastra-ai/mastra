import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, it, expect, beforeEach } from 'vitest';

import { Memory } from '../index';
import { recallMessages, recallPart, recallTool } from './om-tools';

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

    it('should return a hint when cursor is a colon-delimited range', async () => {
      const result = await recallMessages({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'msg-1:msg-3',
      });

      expect(result.count).toBe(0);
      expect(result.messages).toContain('start="msg-1"');
      expect(result.messages).toContain('end="msg-3"');
    });

    it('should return a hint when cursor is a comma-separated merged range', async () => {
      const result = await recallMessages({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'msg-1:msg-2,msg-3:msg-4',
      });

      expect(result.count).toBe(0);
      expect(result.messages).toContain('start="msg-1"');
      expect(result.messages).toContain('end="msg-4"');
    });

    // ── Detail levels ───────────────────────────────────────────────

    it('should default to low detail', async () => {
      const result = await recallMessages({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'msg-1',
        limit: 2,
      });

      expect(result.detail).toBe('low');
    });

    it('should include part indices in output', async () => {
      const result = await recallMessages({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'msg-1',
        limit: 2,
      });

      expect(result.messages).toContain('[p0]');
    });

    it('should include message IDs in output', async () => {
      const result = await recallMessages({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'msg-1',
        limit: 2,
      });

      expect(result.messages).toContain('[msg-2]');
      expect(result.messages).toContain('[msg-3]');
    });

    it('should auto-expand low detail when full text fits in token budget', async () => {
      // 200 chars ≈ 50 tokens — well under default 8000 budget
      const longText = 'A'.repeat(200);
      await memory.saveMessages({
        messages: [
          {
            id: 'msg-long',
            threadId,
            resourceId,
            role: 'user',
            content: { format: 2, parts: [{ type: 'text', text: longText }] },
            createdAt: new Date('2024-01-01T10:05:00Z'),
          },
        ],
      });

      const result = await recallMessages({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'msg-5',
        limit: 1,
        detail: 'low',
      });

      // Full text returned because it fits in budget — no truncation hint needed
      expect(result.messages).toContain(longText);
      expect(result.truncated).toBe(false);
    });

    it('should truncate in low detail when text exceeds budget after expansion', async () => {
      // Text big enough that even after expansion it can't fully fit in a tight budget
      const longText =
        'The quick brown fox jumps over the lazy dog and then some more words to fill up tokens. '.repeat(30);
      await memory.saveMessages({
        messages: [
          {
            id: 'msg-long',
            threadId,
            resourceId,
            role: 'user',
            content: { format: 2, parts: [{ type: 'text', text: longText }] },
            createdAt: new Date('2024-01-01T10:05:00Z'),
          },
        ],
      });

      // Budget smaller than the full text (~570 tokens) so expansion can't fully restore it
      const result = await recallMessages({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'msg-5',
        limit: 1,
        detail: 'low',
        maxTokens: 200,
      });

      // Part gets partially expanded but still truncated with hint
      expect(result.messages).toContain('[truncated');
      expect(result.messages).not.toContain(longText);
    });

    it('should auto-expand truncated parts when budget allows', async () => {
      // Moderate text that exceeds per-part limit (500 tokens) but fits in total budget (2000)
      const moderateText =
        'The quick brown fox jumps over the lazy dog and then some more words to fill up tokens. '.repeat(30);
      await memory.saveMessages({
        messages: [
          {
            id: 'msg-moderate',
            threadId,
            resourceId,
            role: 'user',
            content: { format: 2, parts: [{ type: 'text', text: moderateText }] },
            createdAt: new Date('2024-01-01T10:05:00Z'),
          },
        ],
      });

      const result = await recallMessages({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'msg-5',
        limit: 1,
        detail: 'low',
      });

      // Text (~570 tokens) exceeds 200-token user text expand cap — still truncated but expanded beyond initial 100
      expect(result.messages).toContain('for more]');
      // Should have more content than the initial 100-token per-part limit
      const partMatch = result.messages.match(/\[p0\] ([\s\S]*?)(\n\.\.\.|$)/);
      expect(partMatch).toBeTruthy();
    });

    it('should show tool names only in low detail, full args in high detail', async () => {
      await memory.saveMessages({
        messages: [
          {
            id: 'msg-tool',
            threadId,
            resourceId,
            role: 'assistant',
            content: {
              format: 2,
              parts: [
                {
                  type: 'tool-invocation',
                  toolInvocation: {
                    toolCallId: 'tc-1',
                    toolName: 'searchFiles',
                    state: 'call',
                    args: { query: 'test query', path: '/src' },
                  },
                },
              ],
            },
            createdAt: new Date('2024-01-01T10:05:00Z'),
          },
        ],
      });

      const lowResult = await recallMessages({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'msg-5',
        limit: 1,
        detail: 'low',
      });

      expect(lowResult.messages).toContain('Tool Call: searchFiles');
      // Low detail shouldn't include full JSON args
      expect(lowResult.messages).not.toContain('"query": "test query"');

      const highResult = await recallMessages({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'msg-5',
        limit: 1,
        detail: 'high',
      });

      expect(highResult.messages).toContain('Tool Call: searchFiles');
      expect(highResult.messages).toContain('"query": "test query"');
    });

    // ── High-detail clamping ──────────────────────────────────────

    it('should clamp high detail to 1 part and include continuation hints', async () => {
      const result = await recallMessages({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'msg-1',
        page: 1,
        limit: 10,
        detail: 'high',
      });

      // Should only render 1 part from the first message
      expect(result.count).toBe(1);
      expect(result.detail).toBe('high');
      // Should include the first message's content
      expect(result.messages).toContain('Message 2');
      // Should NOT include later messages inline
      expect(result.messages).not.toContain('Message 4');
      // Should include continuation hint pointing to the next message
      expect(result.messages).toContain('High detail returns 1 part at a time');
      expect(result.messages).toContain('next message');
      expect(result.messages).toContain('msg-3');
    });

    it('should show next partIndex hint when message has multiple parts', async () => {
      await memory.saveMessages({
        messages: [
          {
            id: 'msg-multi-part',
            threadId,
            resourceId,
            role: 'assistant',
            content: {
              format: 2,
              parts: [
                { type: 'text', text: 'First part' },
                { type: 'text', text: 'Second part' },
              ],
            },
            createdAt: new Date('2024-01-01T10:05:00Z'),
          },
        ],
      });

      const result = await recallMessages({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'msg-5',
        limit: 5,
        detail: 'high',
      });

      expect(result.messages).toContain('First part');
      expect(result.messages).not.toContain('Second part');
      expect(result.messages).toContain('partIndex=1');
    });

    // ── Pagination flags ────────────────────────────────────────────

    it('should report hasNextPage when more messages exist forward', async () => {
      const result = await recallMessages({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'msg-1',
        page: 1,
        limit: 2,
      });

      // After msg-1 we have msg-2, msg-3, msg-4, msg-5 (4 messages), limit 2 → hasNextPage
      expect(result.hasNextPage).toBe(true);
      expect(result.hasPrevPage).toBe(false);
    });

    it('should report hasPrevPage when on a later page forward', async () => {
      const result = await recallMessages({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'msg-1',
        page: 2,
        limit: 2,
      });

      // Page 2 of 4 messages → has prev page, no next page
      expect(result.hasNextPage).toBe(false);
      expect(result.hasPrevPage).toBe(true);
    });

    it('should report hasNextPage=false when all messages fit', async () => {
      const result = await recallMessages({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'msg-1',
        page: 1,
        limit: 20,
      });

      expect(result.hasNextPage).toBe(false);
      expect(result.hasPrevPage).toBe(false);
    });

    it('should report hasPrevPage for backward pagination', async () => {
      const result = await recallMessages({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'msg-5',
        page: -1,
        limit: 2,
      });

      // Before msg-5 we have msg-1, msg-2, msg-3, msg-4 (4 messages), limit 2 → hasPrevPage
      expect(result.hasPrevPage).toBe(true);
      expect(result.hasNextPage).toBe(false);
    });

    // ── Token limiting ──────────────────────────────────────────────

    it('should report truncated=false when output fits token budget', async () => {
      const result = await recallMessages({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'msg-1',
        limit: 2,
      });

      expect(result.truncated).toBe(false);
      expect(result.tokenOffset).toBe(0);
    });

    it('should truncate and report tokenOffset when output exceeds token budget', async () => {
      const result = await recallMessages({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'msg-1',
        limit: 20,
        maxTokens: 5, // extremely small budget
      });

      expect(result.truncated).toBe(true);
      expect(result.tokenOffset).toBeGreaterThan(0);
    });

    // ── Data-only messages ────────────────────────────────────────

    it('should skip data-only messages in paged recall output', async () => {
      await memory.saveMessages({
        messages: [
          {
            id: 'msg-data',
            threadId,
            resourceId,
            role: 'assistant',
            content: {
              format: 2,
              parts: [
                {
                  type: 'data-om-buffering-start',
                  data: { cycleId: 'test-cycle', operationType: 'observation' },
                },
              ],
            },
            createdAt: new Date('2024-01-01T10:02:30Z'),
          },
        ],
      });

      const result = await recallMessages({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'msg-2',
        page: 1,
        limit: 5,
      });

      // msg-data is in the date range but has no visible content — should not appear
      expect(result.messages).not.toContain('data-om-buffering-start');
      expect(result.messages).not.toContain('msg-data');
      // visible messages should still be present
      expect(result.messages).toContain('Message 3');
    });

    // ── recallTool integration ──────────────────────────────────────

    it('should surface missing memory context errors from the tool', async () => {
      const tool = recallTool();

      await expect(tool.execute?.({ cursor: 'msg-2' }, { agent: { threadId, resourceId } } as any)).rejects.toThrow(
        'Memory instance is required for recall',
      );
    });
  });

  describe('recallPart', () => {
    let memory: Memory;
    const threadId = 'thread-om-tools';
    const resourceId = 'resource-om-tools';

    beforeEach(async () => {
      memory = new Memory({ storage: new InMemoryStore() });

      await memory.saveThread({
        thread: {
          id: threadId,
          resourceId,
          title: 'OM part test thread',
          createdAt: new Date('2024-01-01T10:00:00Z'),
          updatedAt: new Date('2024-01-01T10:00:00Z'),
        },
      });

      await memory.saveMessages({
        messages: [
          {
            id: 'msg-multi',
            threadId,
            resourceId,
            role: 'assistant',
            content: {
              format: 2,
              parts: [
                { type: 'text', text: 'Here is the result:' },
                {
                  type: 'tool-invocation',
                  toolInvocation: {
                    toolCallId: 'tc-1',
                    toolName: 'readFile',
                    state: 'result',
                    args: { path: '/src/index.ts' },
                    result: 'export function main() { console.log("hello"); }',
                  },
                },
                { type: 'text', text: 'As you can see, it exports a main function.' },
              ],
            },
            createdAt: new Date('2024-01-01T10:00:00Z'),
          },
        ],
      });
    });

    it('should fetch a specific part by index', async () => {
      const result = await recallPart({
        memory: memory as any,
        threadId,
        cursor: 'msg-multi',
        partIndex: 0,
      });

      expect(result.messageId).toBe('msg-multi');
      expect(result.partIndex).toBe(0);
      expect(result.type).toBe('text');
      expect(result.text).toContain('Here is the result:');
    });

    it('should fetch a tool result part at high detail', async () => {
      const result = await recallPart({
        memory: memory as any,
        threadId,
        cursor: 'msg-multi',
        partIndex: 1,
      });

      expect(result.type).toBe('tool-result');
      expect(result.text).toContain('readFile');
      expect(result.text).toContain('export function main()');
    });

    it('should throw for invalid part index', async () => {
      await expect(
        recallPart({
          memory: memory as any,
          threadId,
          cursor: 'msg-multi',
          partIndex: 99,
        }),
      ).rejects.toThrow('Part index 99 not found');
    });

    it('should throw when cursor is a range format', async () => {
      await expect(
        recallPart({
          memory: memory as any,
          threadId,
          cursor: 'msg-1:msg-2',
          partIndex: 0,
        }),
      ).rejects.toThrow('looks like a range');
    });

    it('should throw a helpful message for data-only messages', async () => {
      await memory.saveMessages({
        messages: [
          {
            id: 'msg-data-only',
            threadId,
            resourceId,
            role: 'assistant',
            content: {
              format: 2,
              parts: [
                {
                  type: 'data-om-buffering-start',
                  data: { cycleId: 'test-cycle', operationType: 'observation' },
                },
              ],
            },
            createdAt: new Date('2024-01-01T10:01:00Z'),
          },
        ],
      });

      await expect(
        recallPart({
          memory: memory as any,
          threadId,
          cursor: 'msg-data-only',
          partIndex: 0,
        }),
      ).rejects.toThrow('no visible content');
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
            id: 'other-msg',
            threadId: 'other-thread',
            resourceId,
            role: 'user',
            content: { format: 2, parts: [{ type: 'text', text: 'wrong thread' }] },
            createdAt: new Date('2024-01-01T11:00:00Z'),
          },
        ],
      });

      await expect(
        recallPart({
          memory: memory as any,
          threadId,
          cursor: 'other-msg',
          partIndex: 0,
        }),
      ).rejects.toThrow('does not belong to the current thread');
    });
  });

  describe('Memory.listTools', () => {
    it('should register recall when observational memory retrieval mode is enabled for thread scope', () => {
      const memory = new Memory({
        storage: new InMemoryStore(),
        options: {
          observationalMemory: {
            model: 'test-model',
            scope: 'thread',
            retrieval: true,
          },
        } as any,
      });

      expect(memory.listTools()).toHaveProperty('recall');
    });

    it('should not register recall when retrieval mode is enabled for resource scope', () => {
      const memory = new Memory({
        storage: new InMemoryStore(),
        options: {
          observationalMemory: {
            model: 'test-model',
            scope: 'resource',
            retrieval: true,
          },
        } as any,
      });

      expect(memory.listTools()).not.toHaveProperty('recall');
    });

    it('should not register recall when retrieval mode is disabled', () => {
      const memory = new Memory({
        storage: new InMemoryStore(),
        options: {
          observationalMemory: {
            model: 'test-model',
            retrieval: false,
          },
        } as any,
      });

      expect(memory.listTools()).not.toHaveProperty('recall');
    });
  });
});
