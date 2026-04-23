import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { Memory } from '../index';
import {
  listThreadsForResource,
  recallMessages,
  recallPart,
  recallThreadFromStart,
  recallTool,
  searchMessagesForResource,
} from './om-tools';

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

    it('should browse the cursor thread in resource scope when the cursor belongs to another thread', async () => {
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
          {
            id: 'other-2',
            threadId: 'other-thread',
            resourceId,
            role: 'assistant',
            content: { format: 2, parts: [{ type: 'text', text: 'Follow-up in other thread' }] },
            createdAt: new Date('2024-01-01T11:01:00Z'),
          },
        ],
      });

      const result = await recallMessages({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'other-1',
      });

      expect(result.count).toBe(1);
      expect(result.messages).toContain('Follow-up in other thread');
      expect(result.messages).not.toContain('Cursor does not belong to the active thread');
    });

    it('should return a helpful message for cross-thread cursors in strict thread scope', async () => {
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

      const result = await recallMessages({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'other-1',
        threadScope: threadId,
      });

      expect(result.count).toBe(0);
      expect(result.messages).toContain('Cursor does not belong to the active thread');
      expect(result.messages).toContain('Pass threadId="other-thread"');
      expect(result.messages).toContain('omit threadId and use this cursor directly in resource scope');
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

    it('should return a visible-parts empty message when paged messages have no renderable parts', async () => {
      await memory.saveMessages({
        messages: [
          {
            id: 'msg-empty-text-part',
            threadId,
            resourceId,
            role: 'assistant',
            content: {
              format: 2,
              parts: [{ type: 'text', text: '' }],
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
        page: 1,
        limit: 1,
      });

      expect(result.count).toBe(1);
      expect(result.messages).toBe('(no visible message parts found for this page)');
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

    it('should filter recallMessages by partType', async () => {
      await memory.saveMessages({
        messages: [
          {
            id: 'msg-filter-parts',
            threadId,
            resourceId,
            role: 'assistant',
            content: {
              format: 2,
              parts: [
                { type: 'text', text: 'Intro text' },
                {
                  type: 'tool-invocation',
                  toolInvocation: {
                    toolCallId: 'tc-filter-call',
                    toolName: 'readFile',
                    state: 'call',
                    args: { path: '/src/index.ts' },
                  },
                },
                {
                  type: 'tool-invocation',
                  toolInvocation: {
                    toolCallId: 'tc-filter-result',
                    toolName: 'readFile',
                    state: 'result',
                    args: { path: '/src/index.ts' },
                    result: 'export const value = 1;',
                  },
                },
              ],
            },
            createdAt: new Date('2024-01-01T10:06:00Z'),
          },
        ],
      });

      const toolResultOnly = await recallMessages({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'msg-5',
        limit: 2,
        partType: 'tool-result',
      });

      expect(toolResultOnly.messages).toContain('Tool Result: readFile');
      expect(toolResultOnly.messages).not.toContain('Tool Call: readFile');
      expect(toolResultOnly.messages).not.toContain('Intro text');

      const textOnly = await recallMessages({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'msg-5',
        limit: 2,
        partType: 'text',
      });

      expect(textOnly.messages).toContain('Intro text');
      expect(textOnly.messages).not.toContain('Tool Result: readFile');
      expect(textOnly.messages).not.toContain('Tool Call: readFile');
    });

    it('should filter recallMessages by toolName and combine with partType', async () => {
      await memory.saveMessages({
        messages: [
          {
            id: 'msg-filter-tools',
            threadId,
            resourceId,
            role: 'assistant',
            content: {
              format: 2,
              parts: [
                {
                  type: 'tool-invocation',
                  toolInvocation: {
                    toolCallId: 'tc-web-search',
                    toolName: 'web_search',
                    state: 'call',
                    args: { query: 'mastra recall' },
                  },
                },
                {
                  type: 'tool-invocation',
                  toolInvocation: {
                    toolCallId: 'tc-read-file-result',
                    toolName: 'readFile',
                    state: 'result',
                    args: { path: '/src/index.ts' },
                    result: 'export const read = true;',
                  },
                },
                {
                  type: 'tool-invocation',
                  toolInvocation: {
                    toolCallId: 'tc-web-search-result',
                    toolName: 'web_search',
                    state: 'result',
                    args: { query: 'mastra recall' },
                    result: { results: ['doc-a', 'doc-b'] },
                  },
                },
              ],
            },
            createdAt: new Date('2024-01-01T10:07:00Z'),
          },
        ],
      });

      const toolOnly = await recallMessages({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'msg-5',
        limit: 3,
        toolName: 'web_search',
        detail: 'high',
      });

      expect(toolOnly.messages).toContain('Tool Call: web_search');
      expect(toolOnly.messages).toContain('next part: partIndex=2');
      expect(toolOnly.messages).not.toContain('Tool Result: readFile');

      const toolResultOnly = await recallMessages({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'msg-5',
        limit: 3,
        toolName: 'web_search',
        partType: 'tool-result',
        detail: 'high',
      });

      expect(toolResultOnly.messages).toContain('Tool Result: web_search');
      expect(toolResultOnly.messages).not.toContain('Tool Call: web_search');
      expect(toolResultOnly.messages).not.toContain('Tool Result: readFile');

      const toolCallOnly = await recallMessages({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'msg-5',
        limit: 3,
        toolName: 'web_search',
        partType: 'tool-call',
        detail: 'high',
      });

      expect(toolCallOnly.messages).toContain('Tool Call: web_search');
      expect(toolCallOnly.messages).toContain('"query": "mastra recall"');
      expect(toolCallOnly.messages).not.toContain('Tool Result: web_search');
    });

    it('should return no rendered parts when filters match nothing', async () => {
      await memory.saveMessages({
        messages: [
          {
            id: 'msg-no-filter-match',
            threadId,
            resourceId,
            role: 'assistant',
            content: {
              format: 2,
              parts: [
                {
                  type: 'tool-invocation',
                  toolInvocation: {
                    toolCallId: 'tc-no-match',
                    toolName: 'readFile',
                    state: 'result',
                    args: { path: '/src/index.ts' },
                    result: 'no match expected',
                  },
                },
              ],
            },
            createdAt: new Date('2024-01-01T10:08:00Z'),
          },
        ],
      });

      const result = await recallMessages({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'msg-5',
        limit: 4,
        toolName: 'web_search',
      });

      expect(result.messages).toBe('(no message parts matched the current filters)');
      expect(result.count).toBe(1);
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

    it('should keep next-message continuation hints compatible with part overflow fallback', async () => {
      const highDetail = await recallMessages({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'msg-1',
        page: 1,
        limit: 10,
        detail: 'high',
      });

      expect(highDetail.messages).toContain('next message: partIndex=0 on cursor="msg-3"');

      const continued = await recallPart({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'msg-2',
        partIndex: 1,
      });

      expect(continued.messageId).toBe('msg-3');
      expect(continued.partIndex).toBe(0);
      expect(continued.text).toContain(
        'Part index 1 not found in message msg-2; showing partIndex 0 from next message msg-3.',
      );
      expect(continued.text).toContain('Message 3');
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

  describe('access control', () => {
    let memory: Memory;
    const threadId = 'thread-owner';
    const resourceId = 'resource-owner';
    const otherThreadId = 'thread-other';
    const otherResourceId = 'resource-other';

    beforeEach(async () => {
      memory = new Memory({ storage: new InMemoryStore() });

      // Thread belonging to the current resource
      await memory.saveThread({
        thread: {
          id: threadId,
          resourceId,
          title: 'Owner thread',
          createdAt: new Date('2024-01-01T10:00:00Z'),
          updatedAt: new Date('2024-01-01T10:00:00Z'),
        },
      });

      // Thread belonging to a different resource
      await memory.saveThread({
        thread: {
          id: otherThreadId,
          resourceId: otherResourceId,
          title: 'Other user thread',
          createdAt: new Date('2024-01-01T10:00:00Z'),
          updatedAt: new Date('2024-01-01T10:00:00Z'),
        },
      });

      await memory.saveMessages({
        messages: [
          {
            id: 'owner-msg-1',
            threadId,
            resourceId,
            role: 'user',
            content: { format: 2, parts: [{ type: 'text', text: 'Owner message' }] },
            createdAt: new Date('2024-01-01T10:00:00Z'),
          },
          {
            id: 'other-msg-1',
            threadId: otherThreadId,
            resourceId: otherResourceId,
            role: 'user',
            content: { format: 2, parts: [{ type: 'text', text: 'Other user message' }] },
            createdAt: new Date('2024-01-01T10:00:00Z'),
          },
        ],
      });
    });

    it('should reject cursor from a different resource in recallMessages', async () => {
      await expect(
        recallMessages({
          memory: memory as any,
          threadId: otherThreadId,
          resourceId,
          cursor: 'other-msg-1',
        }),
      ).rejects.toThrow('Could not resolve cursor message');
    });

    it('should return a helpful message for cross-thread cursors in strict thread scope', async () => {
      const result = await recallMessages({
        memory: memory as any,
        threadId: 'different-thread',
        resourceId,
        cursor: 'owner-msg-1',
        threadScope: 'different-thread',
      });

      expect(result.count).toBe(0);
      expect(result.messages).toContain('Cursor does not belong to the active thread');
      expect(result.messages).toContain('different-thread');
      expect(result.messages).toContain(threadId);
    });

    it('should allow cursor from same resource in resource scope', async () => {
      const result = await recallMessages({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'owner-msg-1',
        // no threadScope = resource scope
      });
      expect(result.count).toBeGreaterThanOrEqual(0);
    });

    it('should reject recallPart cursor from a different resource', async () => {
      await expect(
        recallPart({
          memory: memory as any,
          threadId: otherThreadId,
          resourceId,
          cursor: 'other-msg-1',
          partIndex: 0,
        }),
      ).rejects.toThrow('Could not resolve cursor message');
    });

    it('should allow recallPart to resolve a cursor from another thread in the same resource', async () => {
      await memory.saveThread({
        thread: {
          id: 'same-resource-other-thread',
          resourceId,
          title: 'Same resource other thread',
          createdAt: new Date('2024-01-01T10:00:00Z'),
          updatedAt: new Date('2024-01-01T10:00:00Z'),
        },
      });

      await memory.saveMessages({
        messages: [
          {
            id: 'same-resource-other-msg-1',
            threadId: 'same-resource-other-thread',
            resourceId,
            role: 'assistant',
            content: { format: 2, parts: [{ type: 'text', text: 'Same resource other thread message' }] },
            createdAt: new Date('2024-01-01T10:05:00Z'),
          },
        ],
      });

      const result = await recallPart({
        memory: memory as any,
        threadId,
        resourceId,
        threadScope: threadId,
        cursor: 'same-resource-other-msg-1',
        partIndex: 0,
      });

      expect(result.messageId).toBe('same-resource-other-msg-1');
      expect(result.partIndex).toBe(0);
      expect(result.text).toContain('Same resource other thread message');
    });

    it('should reject recallThreadFromStart for a thread from another resource', async () => {
      await expect(
        recallThreadFromStart({
          memory: memory as any,
          threadId: otherThreadId,
          resourceId,
        }),
      ).rejects.toThrow('Thread not found');
    });

    it('should allow recallThreadFromStart for own thread', async () => {
      const result = await recallThreadFromStart({
        memory: memory as any,
        threadId,
        resourceId,
      });
      expect(result.count).toBe(1);
      expect(result.messages).toContain('Owner message');
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

    it('should fall forward to the first part of the next visible message when partIndex overflows', async () => {
      await memory.saveMessages({
        messages: [
          {
            id: 'msg-single',
            threadId,
            resourceId,
            role: 'assistant',
            content: {
              format: 2,
              parts: [{ type: 'text', text: 'Only part here' }],
            },
            createdAt: new Date('2024-01-01T10:02:00Z'),
          },
          {
            id: 'msg-next-visible',
            threadId,
            resourceId,
            role: 'user',
            content: {
              format: 2,
              parts: [{ type: 'text', text: 'This is the next visible message' }],
            },
            createdAt: new Date('2024-01-01T10:03:00Z'),
          },
        ],
      });

      const result = await recallPart({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'msg-single',
        partIndex: 1,
      });

      expect(result.messageId).toBe('msg-next-visible');
      expect(result.partIndex).toBe(0);
      expect(result.role).toBe('user');
      expect(result.type).toBe('text');
      expect(result.text).toContain(
        'Part index 1 not found in message msg-single; showing partIndex 0 from next message msg-next-visible.',
      );
      expect(result.text).toContain('This is the next visible message');
    });

    it('should skip data-only messages when falling forward to the next visible message', async () => {
      await memory.saveMessages({
        messages: [
          {
            id: 'msg-overflow-source',
            threadId,
            resourceId,
            role: 'assistant',
            content: {
              format: 2,
              parts: [{ type: 'text', text: 'Source message' }],
            },
            createdAt: new Date('2024-01-01T10:02:00Z'),
          },
          {
            id: 'msg-hidden-middle',
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
            createdAt: new Date('2024-01-01T10:03:00Z'),
          },
          {
            id: 'msg-visible-after-hidden',
            threadId,
            resourceId,
            role: 'assistant',
            content: {
              format: 2,
              parts: [{ type: 'text', text: 'Visible after hidden' }],
            },
            createdAt: new Date('2024-01-01T10:04:00Z'),
          },
        ],
      });

      const result = await recallPart({
        memory: memory as any,
        threadId,
        resourceId,
        cursor: 'msg-overflow-source',
        partIndex: 1,
      });

      expect(result.messageId).toBe('msg-visible-after-hidden');
      expect(result.text).toContain('Visible after hidden');
      expect(result.text).not.toContain('msg-hidden-middle');
    });

    it('should throw for invalid part index when there is no next visible message', async () => {
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

    it('should allow cross-thread browsing via cursor from another thread', async () => {
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
            content: { format: 2, parts: [{ type: 'text', text: 'content from other thread' }] },
            createdAt: new Date('2024-01-01T11:00:00Z'),
          },
        ],
      });

      const result = await recallPart({
        memory: memory as any,
        threadId,
        cursor: 'other-msg',
        partIndex: 0,
      });

      expect(result.text).toContain('content from other thread');
      expect(result.messageId).toBe('other-msg');
    });
  });

  describe('listThreadsForResource', () => {
    let memory: Memory;
    const resourceId = 'resource-threads';

    beforeEach(async () => {
      memory = new Memory({ storage: new InMemoryStore() });

      await memory.saveThread({
        thread: {
          id: 'thread-1',
          resourceId,
          title: 'Planning session',
          createdAt: new Date('2024-01-01T10:00:00Z'),
          updatedAt: new Date('2024-01-03T10:00:00Z'),
        },
      });
      await memory.saveThread({
        thread: {
          id: 'thread-2',
          resourceId,
          title: 'Coding session',
          createdAt: new Date('2024-01-02T10:00:00Z'),
          updatedAt: new Date('2024-01-04T10:00:00Z'),
        },
      });
      await memory.saveThread({
        thread: {
          id: 'thread-3',
          resourceId,
          title: 'Review session',
          createdAt: new Date('2024-01-03T10:00:00Z'),
          updatedAt: new Date('2024-01-05T10:00:00Z'),
        },
      });
      // Thread from a different resource — should not appear
      await memory.saveThread({
        thread: {
          id: 'thread-other',
          resourceId: 'other-resource',
          title: 'Other user thread',
          createdAt: new Date('2024-01-01T10:00:00Z'),
          updatedAt: new Date('2024-01-06T10:00:00Z'),
        },
      });
    });

    it('should list threads for the current resource', async () => {
      const result = await listThreadsForResource({
        memory: memory as any,
        resourceId,
        currentThreadId: 'thread-2',
      });

      expect(result.count).toBe(3);
      expect(result.threads).toContain('Planning session');
      expect(result.threads).toContain('Coding session');
      expect(result.threads).toContain('Review session');
      expect(result.threads).not.toContain('Other user thread');
    });

    it('should mark the current thread', async () => {
      const result = await listThreadsForResource({
        memory: memory as any,
        resourceId,
        currentThreadId: 'thread-2',
      });

      expect(result.threads).toContain('← current');
      // The current marker should appear on the Coding session line
      const lines = result.threads.split('\n');
      const codingLine = lines.find(l => l.includes('Coding session'));
      expect(codingLine).toContain('← current');
    });

    it('should include thread IDs and dates', async () => {
      const result = await listThreadsForResource({
        memory: memory as any,
        resourceId,
        currentThreadId: 'thread-1',
      });

      expect(result.threads).toContain('thread-1');
      expect(result.threads).toContain('thread-2');
      expect(result.threads).toContain('thread-3');
      expect(result.threads).toContain('updated:');
      expect(result.threads).toContain('created:');
    });

    it('should paginate threads', async () => {
      const page1 = await listThreadsForResource({
        memory: memory as any,
        resourceId,
        currentThreadId: 'thread-1',
        limit: 2,
        page: 0,
      });

      expect(page1.count).toBe(2);
      expect(page1.hasMore).toBe(true);

      const page2 = await listThreadsForResource({
        memory: memory as any,
        resourceId,
        currentThreadId: 'thread-1',
        limit: 2,
        page: 1,
      });

      expect(page2.count).toBe(1);
      expect(page2.hasMore).toBe(false);
    });

    it('should return helpful message when no threads found', async () => {
      const result = await listThreadsForResource({
        memory: memory as any,
        resourceId: 'nonexistent-resource',
        currentThreadId: 'thread-1',
      });

      expect(result.count).toBe(0);
      expect(result.threads).toContain('No threads found');
    });

    it('should filter threads by before date', async () => {
      const result = await listThreadsForResource({
        memory: memory as any,
        resourceId,
        currentThreadId: 'thread-1',
        before: '2024-01-02T10:00:00Z',
      });

      expect(result.count).toBe(1);
      expect(result.threads).toContain('Planning session');
      expect(result.threads).not.toContain('Coding session');
      expect(result.threads).not.toContain('Review session');
    });

    it('should filter threads by after date', async () => {
      const result = await listThreadsForResource({
        memory: memory as any,
        resourceId,
        currentThreadId: 'thread-1',
        after: '2024-01-02T00:00:00Z',
      });

      expect(result.count).toBe(2);
      expect(result.threads).toContain('Coding session');
      expect(result.threads).toContain('Review session');
      expect(result.threads).not.toContain('Planning session');
    });

    it('should filter threads by before and after combined', async () => {
      const result = await listThreadsForResource({
        memory: memory as any,
        resourceId,
        currentThreadId: 'thread-1',
        before: '2024-01-03T00:00:00Z',
        after: '2024-01-01T12:00:00Z',
      });

      expect(result.count).toBe(1);
      expect(result.threads).toContain('Coding session');
      expect(result.threads).not.toContain('Planning session');
      expect(result.threads).not.toContain('Review session');
    });

    it('should paginate date-filtered threads', async () => {
      const result = await listThreadsForResource({
        memory: memory as any,
        resourceId,
        currentThreadId: 'thread-1',
        after: '2024-01-01T00:00:00Z',
        limit: 1,
        page: 0,
      });

      expect(result.count).toBe(1);
      expect(result.hasMore).toBe(true);

      const page2 = await listThreadsForResource({
        memory: memory as any,
        resourceId,
        currentThreadId: 'thread-1',
        after: '2024-01-01T00:00:00Z',
        limit: 1,
        page: 1,
      });

      expect(page2.count).toBe(1);
      expect(page2.hasMore).toBe(true);
    });
  });

  describe('cross-thread recallMessages', () => {
    let memory: Memory;
    const resourceId = 'resource-cross-thread';

    beforeEach(async () => {
      memory = new Memory({ storage: new InMemoryStore() });

      await memory.saveThread({
        thread: {
          id: 'current-thread',
          resourceId,
          title: 'Current thread',
          createdAt: new Date('2024-01-01T10:00:00Z'),
          updatedAt: new Date('2024-01-01T10:00:00Z'),
        },
      });

      await memory.saveThread({
        thread: {
          id: 'other-thread',
          resourceId,
          title: 'Other thread',
          createdAt: new Date('2024-01-02T10:00:00Z'),
          updatedAt: new Date('2024-01-02T10:00:00Z'),
        },
      });

      await memory.saveMessages({
        messages: [
          {
            id: 'other-msg-1',
            threadId: 'other-thread',
            resourceId,
            role: 'user',
            content: { format: 2, parts: [{ type: 'text', text: 'Hello from other thread' }] },
            createdAt: new Date('2024-01-02T10:00:00Z'),
          },
          {
            id: 'other-msg-2',
            threadId: 'other-thread',
            resourceId,
            role: 'assistant',
            content: { format: 2, parts: [{ type: 'text', text: 'Response in other thread' }] },
            createdAt: new Date('2024-01-02T10:01:00Z'),
          },
          {
            id: 'other-msg-3',
            threadId: 'other-thread',
            resourceId,
            role: 'user',
            content: { format: 2, parts: [{ type: 'text', text: 'Follow-up in other thread' }] },
            createdAt: new Date('2024-01-02T10:02:00Z'),
          },
        ],
      });
    });

    it('should browse messages in another thread via cursor', async () => {
      const result = await recallMessages({
        memory: memory as any,
        threadId: 'other-thread',
        resourceId,
        cursor: 'other-msg-1',
        page: 1,
        detail: 'low',
      });

      expect(result.count).toBeGreaterThan(0);
      expect(result.messages).toContain('Response in other thread');
    });

    it('should page through another thread', async () => {
      const result = await recallMessages({
        memory: memory as any,
        threadId: 'other-thread',
        resourceId,
        cursor: 'other-msg-1',
        page: 1,
        limit: 1,
        detail: 'low',
      });

      expect(result.count).toBe(1);
      expect(result.messages).toContain('Response in other thread');
      expect(result.hasNextPage).toBe(true);

      // Page forward
      const page2 = await recallMessages({
        memory: memory as any,
        threadId: 'other-thread',
        resourceId,
        cursor: 'other-msg-1',
        page: 2,
        limit: 1,
        detail: 'low',
      });

      expect(page2.count).toBe(1);
      expect(page2.messages).toContain('Follow-up in other thread');
    });
  });

  describe('recallThreadFromStart', () => {
    let memory: Memory;
    const resourceId = 'resource-from-start';
    const threadId = 'thread-from-start';

    beforeEach(async () => {
      memory = new Memory({ storage: new InMemoryStore() });

      await memory.saveThread({
        thread: {
          id: threadId,
          resourceId,
          title: 'Thread to browse',
          createdAt: new Date('2024-01-01T10:00:00Z'),
          updatedAt: new Date('2024-01-01T10:00:00Z'),
        },
      });

      const msgs: MastraDBMessage[] = [];
      for (let i = 1; i <= 5; i++) {
        msgs.push({
          id: `start-msg-${i}`,
          threadId,
          resourceId,
          role: i % 2 === 1 ? 'user' : 'assistant',
          content: { format: 2, parts: [{ type: 'text', text: `Message ${i} content` }] },
          createdAt: new Date(`2024-01-01T10:0${i}:00Z`),
        });
      }
      await memory.saveMessages({ messages: msgs });
    });

    it('should read from the beginning of a thread without a cursor', async () => {
      const result = await recallThreadFromStart({
        memory: memory as any,
        threadId,
        resourceId,
      });

      expect(result.count).toBe(5);
      expect(result.messages).toContain('Message 1 content');
      expect(result.messages).toContain('Message 5 content');
      expect(result.page).toBe(1);
      expect(result.hasPrevPage).toBe(false);
      expect(result.hasNextPage).toBe(false);
    });

    it('should paginate through a thread', async () => {
      const page1 = await recallThreadFromStart({
        memory: memory as any,
        threadId,
        resourceId,
        page: 1,
        limit: 2,
      });

      expect(page1.count).toBe(2);
      expect(page1.messages).toContain('Message 1 content');
      expect(page1.messages).toContain('Message 2 content');
      expect(page1.hasNextPage).toBe(true);
      expect(page1.hasPrevPage).toBe(false);

      const page2 = await recallThreadFromStart({
        memory: memory as any,
        threadId,
        resourceId,
        page: 2,
        limit: 2,
      });

      expect(page2.count).toBe(2);
      expect(page2.messages).toContain('Message 3 content');
      expect(page2.messages).toContain('Message 4 content');
      expect(page2.hasNextPage).toBe(true);
      expect(page2.hasPrevPage).toBe(true);

      const page3 = await recallThreadFromStart({
        memory: memory as any,
        threadId,
        resourceId,
        page: 3,
        limit: 2,
      });

      expect(page3.count).toBe(1);
      expect(page3.messages).toContain('Message 5 content');
      expect(page3.hasNextPage).toBe(false);
      expect(page3.hasPrevPage).toBe(true);
    });

    it('should return an explicit empty-page message for oversized pages', async () => {
      const result = await recallThreadFromStart({
        memory: memory as any,
        threadId,
        resourceId,
        page: 50,
        limit: 2,
      });

      expect(result.page).toBe(50);
      expect(result.count).toBe(0);
      expect(result.messages).toBe('(no messages found on page 50 for this thread)');
      expect(result.hasNextPage).toBe(false);
      expect(result.hasPrevPage).toBe(true);
    });

    it('should paginate from the newest messages when anchor is end', async () => {
      const page1 = await recallThreadFromStart({
        memory: memory as any,
        threadId,
        resourceId,
        page: 1,
        limit: 2,
        anchor: 'end',
      });

      expect(page1.page).toBe(1);
      expect(page1.count).toBe(2);
      expect(page1.messages).toContain('Message 4 content');
      expect(page1.messages).toContain('Message 5 content');
      expect(page1.messages).not.toContain('Message 1 content');
      expect(page1.hasNextPage).toBe(false);
      expect(page1.hasPrevPage).toBe(true);

      const page2 = await recallThreadFromStart({
        memory: memory as any,
        threadId,
        resourceId,
        page: 2,
        limit: 2,
        anchor: 'end',
      });

      expect(page2.page).toBe(2);
      expect(page2.count).toBe(2);
      expect(page2.messages).toContain('Message 2 content');
      expect(page2.messages).toContain('Message 3 content');
      expect(page2.messages).not.toContain('Message 5 content');
      expect(page2.hasNextPage).toBe(true);
      expect(page2.hasPrevPage).toBe(true);
    });

    it('should return empty message for a thread with no messages', async () => {
      await memory.saveThread({
        thread: {
          id: 'empty-thread',
          resourceId,
          title: 'Empty thread',
          createdAt: new Date('2024-01-02T10:00:00Z'),
          updatedAt: new Date('2024-01-02T10:00:00Z'),
        },
      });

      const result = await recallThreadFromStart({
        memory: memory as any,
        threadId: 'empty-thread',
        resourceId,
      });

      expect(result.count).toBe(0);
      expect(result.messages).toContain('no messages');
    });

    it('should filter recallThreadFromStart by partType and toolName', async () => {
      await memory.saveMessages({
        messages: [
          {
            id: 'start-msg-tool-filter',
            threadId,
            resourceId,
            role: 'assistant',
            content: {
              format: 2,
              parts: [
                { type: 'text', text: 'Thread intro' },
                {
                  type: 'tool-invocation',
                  toolInvocation: {
                    toolCallId: 'tc-start-read-call',
                    toolName: 'readFile',
                    state: 'call',
                    args: { path: '/src/a.ts' },
                  },
                },
                {
                  type: 'tool-invocation',
                  toolInvocation: {
                    toolCallId: 'tc-start-read-result',
                    toolName: 'readFile',
                    state: 'result',
                    args: { path: '/src/a.ts' },
                    result: 'export const a = 1;',
                  },
                },
                {
                  type: 'tool-invocation',
                  toolInvocation: {
                    toolCallId: 'tc-start-web-result',
                    toolName: 'web_search',
                    state: 'result',
                    args: { query: 'memory' },
                    result: { results: ['memory docs'] },
                  },
                },
              ],
            },
            createdAt: new Date('2024-01-01T10:06:00Z'),
          },
        ],
      });

      const byType = await recallThreadFromStart({
        memory: memory as any,
        threadId,
        resourceId,
        partType: 'tool-result',
        detail: 'high',
      });

      expect(byType.messages).toContain('Tool Result: readFile');
      expect(byType.messages).toContain('Tool Result: web_search');
      expect(byType.messages).not.toContain('Tool Call: readFile');
      expect(byType.messages).not.toContain('Thread intro');

      const byTool = await recallThreadFromStart({
        memory: memory as any,
        threadId,
        resourceId,
        toolName: 'readFile',
        detail: 'high',
      });

      expect(byTool.messages).toContain('Tool Call: readFile');
      expect(byTool.messages).toContain('Tool Result: readFile');
      expect(byTool.messages).not.toContain('Tool Result: web_search');
      expect(byTool.messages).not.toContain('Thread intro');

      const combined = await recallThreadFromStart({
        memory: memory as any,
        threadId,
        resourceId,
        toolName: 'readFile',
        partType: 'tool-result',
        detail: 'high',
      });

      expect(combined.messages).toContain('Tool Result: readFile');
      expect(combined.messages).not.toContain('Tool Call: readFile');
      expect(combined.messages).not.toContain('Tool Result: web_search');

      const toolCalls = await recallThreadFromStart({
        memory: memory as any,
        threadId,
        resourceId,
        toolName: 'readFile',
        partType: 'tool-call',
        detail: 'high',
      });

      expect(toolCalls.messages).toContain('Tool Call: readFile');
      expect(toolCalls.messages).toContain('"path": "/src/a.ts"');
      expect(toolCalls.messages).not.toContain('Tool Result: readFile');
    });

    it('should support array-shaped tool-call and tool-result parts', async () => {
      const mockMemory = {
        recall: vi.fn().mockResolvedValue({
          messages: [
            {
              id: 'msg-array-tool-parts',
              threadId,
              resourceId,
              role: 'assistant',
              content: [
                { type: 'text', text: 'Array intro' },
                {
                  type: 'tool-call',
                  toolCallId: 'call-array-1',
                  toolName: 'execute_command',
                  args: { command: 'pwd' },
                },
                {
                  type: 'tool-result',
                  toolCallId: 'call-array-1',
                  toolName: 'execute_command',
                  result: { stdout: '/tmp' },
                },
              ],
              createdAt: new Date('2024-01-01T10:09:00Z'),
            },
          ],
        }),
        getThreadById: vi.fn().mockResolvedValue({ threadId, resourceId }),
      };

      const toolCalls = await recallThreadFromStart({
        memory: mockMemory as any,
        threadId,
        resourceId,
        partType: 'tool-call',
        toolName: 'execute_command',
        detail: 'high',
      });

      expect(toolCalls.messages).toContain('Tool Call: execute_command');
      expect(toolCalls.messages).toContain('"command": "pwd"');
      expect(toolCalls.messages).not.toContain('Array intro');

      const toolResults = await recallThreadFromStart({
        memory: mockMemory as any,
        threadId,
        resourceId,
        partType: 'tool-result',
        toolName: 'execute_command',
        detail: 'high',
      });

      expect(toolResults.messages).toContain('Tool Result: execute_command');
      expect(toolResults.messages).toContain('stdout');
    });

    it('should distinguish filtered-empty results from empty threads', async () => {
      await memory.saveMessages({
        messages: [
          {
            id: 'msg-filtered-empty-state',
            threadId,
            resourceId,
            role: 'assistant',
            content: {
              format: 2,
              parts: [{ type: 'text', text: 'Only text here' }],
            },
            createdAt: new Date('2024-01-01T10:10:00Z'),
          },
        ],
      });

      const result = await recallThreadFromStart({
        memory: memory as any,
        threadId,
        resourceId,
        partType: 'tool-call',
      });

      expect(result.messages).toBe('(no message parts matched the current filters)');
      expect(result.count).toBeGreaterThan(0);
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

    it('should register recall when retrieval mode is enabled for resource scope', () => {
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

      expect(memory.listTools()).toHaveProperty('recall');
    });

    it('should throw when retrieval has vector: true but no vector store', () => {
      expect(
        () =>
          new Memory({
            storage: new InMemoryStore(),
            options: {
              observationalMemory: {
                model: 'test-model',
                scope: 'thread',
                retrieval: { vector: true },
              },
            } as any,
          }),
      ).toThrow('requires a vector store');
    });

    it('should throw when retrieval has vector: true but no embedder', () => {
      expect(
        () =>
          new Memory({
            storage: new InMemoryStore(),
            vector: { id: 'test' } as any,
            options: {
              observationalMemory: {
                model: 'test-model',
                scope: 'thread',
                retrieval: { vector: true },
              },
            } as any,
          }),
      ).toThrow('requires an embedder');
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

  describe('searchMessagesForResource', () => {
    it('should allow thread-scoped mode="threads" without resourceId', async () => {
      const tool = recallTool(undefined, { retrievalScope: 'thread' });
      const memory = {
        getThreadById: async ({ threadId }: { threadId: string }) => ({
          id: threadId,
          title: 'Current Thread',
          resourceId: 'res',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
        }),
      };

      const result = await tool.execute?.({ mode: 'threads' }, { memory, agent: { threadId: 'thread-a' } } as any);

      expect(result).toMatchObject({ count: 1, hasMore: false });
      expect((result as any).threads).toContain('Current Thread');
    });

    it('should overfetch before applying thread and date filters', async () => {
      const threads = [
        {
          id: 'thread-a',
          title: 'Current Thread',
          resourceId: 'res',
          createdAt: new Date('2024-01-10'),
          updatedAt: new Date('2024-01-10'),
        },
        {
          id: 'thread-b',
          title: 'Older Thread',
          resourceId: 'res',
          createdAt: new Date('2024-01-20'),
          updatedAt: new Date('2024-01-20'),
        },
      ];

      const searchMessages = vi.fn().mockResolvedValue({
        results: [
          {
            threadId: 'thread-a',
            groupId: 'group-a',
            range: 'msg-1:msg-2',
            score: 0.99,
            text: 'Current thread hit',
            observedAt: new Date('2024-01-10T00:00:00.000Z'),
          },
          {
            threadId: 'thread-b',
            groupId: 'group-b',
            range: 'msg-3:msg-4',
            score: 0.88,
            text: 'Older thread hit',
            observedAt: new Date('2024-01-20T00:00:00.000Z'),
          },
        ],
      });

      const memory = {
        listThreads: async () => ({ threads, total: threads.length, hasMore: false, page: 0 }),
        searchMessages,
        getThreadById: async ({ threadId }: { threadId: string }) => threads.find(t => t.id === threadId) || null,
      };

      const result = await searchMessagesForResource({
        memory: memory as any,
        resourceId: 'res',
        currentThreadId: 'thread-a',
        query: 'older thread',
        topK: 1,
        after: '2024-01-15',
      });

      expect(searchMessages).toHaveBeenCalledWith({
        query: 'older thread',
        resourceId: 'res',
        topK: 11,
        filter: { observedAfter: new Date('2024-01-15T00:00:00.000Z') },
      });
      expect(result.count).toBe(1);
      expect(result.results).toContain('Older Thread');
      expect(result.results).not.toContain('Current Thread');
    });

    function makeMockMemory({
      searchResults = [],
      messages = [],
      threads = [],
    }: {
      searchResults?: Array<{
        threadId: string;
        score: number;
        groupId?: string;
        range?: string;
        text?: string;
        observedAt?: Date;
      }>;
      messages?: MastraDBMessage[];
      threads?: Array<{ id: string; title?: string; resourceId: string; createdAt: Date; updatedAt: Date }>;
    }) {
      return {
        recall: async () => ({ messages: [] }),
        getMemoryStore: async () => ({
          listMessagesById: async ({ messageIds }: { messageIds: string[] }) => ({
            messages: messages.filter(m => messageIds.includes(m.id)),
          }),
        }),
        listThreads: async () => ({ threads, total: threads.length, hasMore: false, page: 0 }),
        searchMessages: async () => ({ results: searchResults }),
        getThreadById: async ({ threadId }: { threadId: string }) => threads.find(t => t.id === threadId) || null,
      };
    }

    it('should return markdown-formatted observation search results with raw observation text', async () => {
      const threads = [
        {
          id: 'thread-a',
          title: 'Setup Help',
          resourceId: 'res',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'thread-b',
          title: 'Search Docs',
          resourceId: 'res',
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        },
      ];

      const memory = makeMockMemory({
        searchResults: [
          {
            threadId: 'thread-a',
            groupId: 'group-1',
            range: 'msg-1:msg-3',
            score: 0.95,
            text: 'Observed setup discussion about vector search.',
          },
          {
            threadId: 'thread-b',
            groupId: 'group-2',
            range: 'msg-4:msg-5',
            score: 0.82,
            text: 'Observed search documentation discussion.',
          },
        ],
        threads,
      });

      const result = await searchMessagesForResource({
        memory,
        resourceId: 'res',
        currentThreadId: 'thread-a',
        query: 'vector search',
      });

      expect(result.count).toBe(2);
      expect(result.results).toContain('### Current thread memory');
      expect(result.results).toContain('### Older memory from another thread');
      expect(result.results).toContain('This result came from the current thread.');
      expect(result.results).toContain('This result came from an older memory generation in another thread.');
      expect(result.results).toContain('- thread: thread-a (Setup Help)');
      expect(result.results).toContain('- thread: thread-b (Search Docs)');
      expect(result.results).toContain('- source: raw messages from ID msg-1 through ID msg-3');
      expect(result.results).toContain('- source: raw messages from ID msg-4 through ID msg-5');
      expect(result.results).toContain('- observation group: group-1');
      expect(result.results).toContain('- observation group: group-2');
      expect(result.results).toContain('```text');
      expect(result.results).toContain('Observed setup discussion about vector search.');
      expect(result.results).toContain('Observed search documentation discussion.');
    });

    it('should return empty message when no results found', async () => {
      const memory = makeMockMemory({ searchResults: [] });

      const result = await searchMessagesForResource({
        memory,
        resourceId: 'res',
        query: 'nonexistent topic',
      });

      expect(result.count).toBe(0);
      expect(result.results).toBe('No matching messages found.');
    });

    it('should return helpful message when searchMessages is not available', async () => {
      const memory = {
        recall: async () => ({ messages: [] }),
        getMemoryStore: async () => ({ listMessagesById: async () => ({ messages: [] }) }),
        listThreads: async () => ({ threads: [], total: 0, hasMore: false, page: 0 }),
      };

      const result = await searchMessagesForResource({
        memory,
        resourceId: 'res',
        query: 'test',
      });

      expect(result.count).toBe(0);
      expect(result.results).toContain('Search is not configured');
      expect(result.results).toContain('retrieval: { vector: true }');
    });

    it('should fall back when observation text is unavailable', async () => {
      const memory = makeMockMemory({
        searchResults: [{ threadId: 'thread-a', groupId: 'group-empty', range: 'msg-1:msg-2', score: 0.7, text: '' }],
      });

      const result = await searchMessagesForResource({
        memory,
        resourceId: 'res',
        query: 'test',
      });

      expect(result.count).toBe(1);
      expect(result.results).toContain('- thread: thread-a');
      expect(result.results).toContain('_Observation text unavailable._');
    });

    it('should apply thread and date filters before the final topK slice', async () => {
      const threads = [
        {
          id: 'thread-a',
          title: 'Current Thread',
          resourceId: 'res',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'thread-b',
          title: 'Filtered In',
          resourceId: 'res',
          createdAt: new Date('2024-01-02'),
          updatedAt: new Date('2024-01-02'),
        },
        {
          id: 'thread-c',
          title: 'Filtered Out',
          resourceId: 'res',
          createdAt: new Date('2024-01-03'),
          updatedAt: new Date('2024-01-03'),
        },
      ];

      const memory = makeMockMemory({
        searchResults: [
          {
            threadId: 'thread-c',
            groupId: 'group-1',
            range: 'msg-1:msg-2',
            score: 0.99,
            text: 'out',
            observedAt: new Date('2024-01-04T00:00:00Z'),
          },
          {
            threadId: 'thread-c',
            groupId: 'group-2',
            range: 'msg-3:msg-4',
            score: 0.98,
            text: 'out',
            observedAt: new Date('2024-01-04T00:00:00Z'),
          },
          {
            threadId: 'thread-b',
            groupId: 'group-3',
            range: 'msg-5:msg-6',
            score: 0.97,
            text: 'in',
            observedAt: new Date('2024-01-02T00:00:00Z'),
          },
        ],
        threads,
      });

      const result = await searchMessagesForResource({
        memory,
        resourceId: 'res',
        query: 'test',
        topK: 1,
        before: '2024-01-03T00:00:00Z',
      });

      expect(result.count).toBe(1);
      expect(result.results).toContain('Filtered In');
      expect(result.results).not.toContain('Filtered Out');
    });

    it('should apply a final token cap to the assembled markdown output', async () => {
      const memory = makeMockMemory({
        searchResults: [
          {
            threadId: 'thread-a',
            groupId: 'group-long',
            range: 'msg-1:msg-99',
            score: 0.9,
            text: Array.from({ length: 300 }, () => 'observation').join(' '),
          },
        ],
      });

      const result = await searchMessagesForResource({
        memory,
        resourceId: 'res',
        currentThreadId: 'thread-a',
        query: 'test',
        maxTokens: 40,
      });

      expect(result.count).toBe(1);
      expect(result.results).toContain('### Current thread memory');
      expect(result.results.length).toBeLessThan(Array.from({ length: 300 }, () => 'observation').join(' ').length);
    });

    it('should return helpful message when search is not configured', async () => {
      const memory = {
        recall: async () => ({ messages: [] }),
        getMemoryStore: async () => ({
          listMessagesById: async () => ({ messages: [] }),
        }),
        listThreads: async () => ({ threads: [], total: 0, hasMore: false, page: 0 }),
        // no searchMessages — simulates retrieval: true without search
      };

      const result = await searchMessagesForResource({
        memory,
        resourceId: 'res',
        query: 'test',
      });

      expect(result.count).toBe(0);
      expect(result.results).toContain('Search is not configured');
      expect(result.results).toContain('retrieval: { vector: true }');
    });
  });

  describe('recallTool message scoping', () => {
    it('should require cursor or threadId for mode="messages"', async () => {
      const tool = recallTool(undefined, { retrievalScope: 'resource' });

      await expect(
        tool.execute?.({ mode: 'messages' }, {
          memory: {},
          agent: { threadId: 'thread-a', resourceId: 'res-a' },
        } as any),
      ).rejects.toThrow('Either cursor or threadId is required for mode="messages"');
    });

    it('should allow cursor-only browsing in resource scope by resolving the cursor thread', async () => {
      const tool = recallTool(undefined, { retrievalScope: 'resource' });
      const recallMock = vi.fn().mockResolvedValue({ messages: [] });

      const memory = {
        getMemoryStore: async () => ({
          listMessagesById: async () => ({
            messages: [
              {
                id: 'msg-1',
                threadId: 'thread-from-cursor',
                resourceId: 'res-a',
                role: 'user',
                content: { format: 2, parts: [{ type: 'text', text: 'Message 1' }] },
                createdAt: new Date('2024-01-01T10:00:00Z'),
              },
            ],
          }),
        }),
        recall: recallMock,
      };

      const result = await tool.execute?.({ mode: 'messages', cursor: 'msg-1' }, {
        memory,
        agent: { resourceId: 'res-a' },
      } as any);

      expect((result as any)?.cursor).toBe('msg-1');
      expect(recallMock).toHaveBeenCalled();
    });

    it('should resolve threadId="current" for mode="messages" in resource scope', async () => {
      const tool = recallTool(undefined, { retrievalScope: 'resource' });
      const getThreadById = vi.fn().mockResolvedValue({
        id: 'thread-a',
        resourceId: 'res-a',
        createdAt: new Date('2024-01-01T09:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z'),
      });
      const recallMock = vi.fn().mockResolvedValue({ messages: [] });

      await tool.execute?.(
        { mode: 'messages', threadId: 'current' } as any,
        {
          memory: { getThreadById, recall: recallMock },
          agent: { threadId: 'thread-a', resourceId: 'res-a' },
        } as any,
      );

      expect(getThreadById).toHaveBeenCalledWith({ threadId: 'thread-a' });
      expect(recallMock).toHaveBeenCalledWith(expect.objectContaining({ threadId: 'thread-a', resourceId: 'res-a' }));
    });

    it('should pass anchor="end" through for mode="messages" without a cursor', async () => {
      const tool = recallTool(undefined, { retrievalScope: 'resource' });
      const getThreadById = vi.fn().mockResolvedValue({
        id: 'thread-a',
        resourceId: 'res-a',
        createdAt: new Date('2024-01-01T09:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z'),
      });
      const recallMock = vi.fn().mockResolvedValue({
        messages: [
          {
            id: 'msg-1',
            threadId: 'thread-a',
            resourceId: 'res-a',
            role: 'user',
            content: { format: 2, parts: [{ type: 'text', text: 'Message 1' }] },
            createdAt: new Date('2024-01-01T10:00:00Z'),
          },
          {
            id: 'msg-2',
            threadId: 'thread-a',
            resourceId: 'res-a',
            role: 'assistant',
            content: { format: 2, parts: [{ type: 'text', text: 'Message 2' }] },
            createdAt: new Date('2024-01-01T10:01:00Z'),
          },
        ],
      });

      const result = await tool.execute?.(
        { mode: 'messages', threadId: 'current', anchor: 'end', page: 1, limit: 1 } as any,
        {
          memory: { getThreadById, recall: recallMock },
          agent: { threadId: 'thread-a', resourceId: 'res-a' },
        } as any,
      );

      expect((result as any)?.messages).toContain('Message 2');
      expect((result as any)?.page).toBe(1);
      expect((result as any)?.hasPrevPage).toBe(true);
      expect((result as any)?.hasNextPage).toBe(false);
    });

    it('should reject threadId="current" when there is no current thread in context', async () => {
      const tool = recallTool(undefined, { retrievalScope: 'resource' });

      await expect(
        tool.execute?.(
          { mode: 'messages', threadId: 'current' } as any,
          { memory: {}, agent: { resourceId: 'res-a' } } as any,
        ),
      ).rejects.toThrow('Could not resolve current thread.');
    });

    it('should resolve threadId="current" for mode="search" in resource scope', async () => {
      const tool = recallTool(undefined, { retrievalScope: 'resource' });
      const searchMessages = vi.fn().mockResolvedValue({ results: [] });
      const listThreads = vi.fn().mockResolvedValue({ threads: [], total: 0, hasMore: false, page: 0 });

      await tool.execute?.(
        { mode: 'search', query: 'test query', threadId: 'current' } as any,
        {
          memory: { searchMessages, listThreads },
          agent: { threadId: 'thread-a', resourceId: 'res-a' },
        } as any,
      );

      expect(searchMessages).toHaveBeenCalledWith(
        expect.objectContaining({ filter: expect.objectContaining({ threadId: 'thread-a' }) }),
      );
    });

    it('should resolve a visible cursor from resource recall when direct lookup misses', async () => {
      const tool = recallTool(undefined, { retrievalScope: 'resource' });
      const listThreadsMock = vi.fn().mockResolvedValue({
        threads: [
          {
            id: 'thread-from-recall',
            resourceId: 'res-a',
            title: 'Recovered thread',
            createdAt: new Date('2024-01-01T09:00:00Z'),
            updatedAt: new Date('2024-01-01T10:00:00Z'),
          },
        ],
        total: 1,
        hasMore: false,
        page: 0,
      });
      const recoveredMessage = {
        id: 'visible-msg',
        threadId: 'thread-from-recall',
        resourceId: 'res-a',
        role: 'assistant',
        content: { format: 2, parts: [{ type: 'text', text: 'Recovered message' }] },
        createdAt: new Date('2024-01-01T10:00:00Z'),
      };
      const recallMock = vi
        .fn()
        .mockResolvedValueOnce({
          messages: [recoveredMessage],
        })
        .mockResolvedValueOnce({
          messages: [recoveredMessage],
        })
        .mockResolvedValueOnce({
          messages: [],
        });
      const memory = {
        getMemoryStore: async () => ({
          listMessagesById: async () => ({ messages: [] }),
        }),
        listThreads: listThreadsMock,
        recall: recallMock,
      };

      const result = await tool.execute?.({ mode: 'messages', cursor: 'visible-msg' }, {
        memory,
        agent: { resourceId: 'res-a' },
      } as any);

      expect((result as any)?.cursor).toBe('visible-msg');
      expect(listThreadsMock).toHaveBeenCalledWith({
        page: 0,
        perPage: 100,
        orderBy: { field: 'updatedAt', direction: 'DESC' },
        filter: { resourceId: 'res-a' },
      });
      expect(recallMock).toHaveBeenNthCalledWith(1, {
        threadId: 'thread-from-recall',
        resourceId: 'res-a',
        page: 0,
        perPage: false,
      });
      expect(recallMock).toHaveBeenNthCalledWith(2, {
        threadId: 'thread-from-recall',
        resourceId: 'res-a',
        page: 0,
        perPage: false,
      });
      expect(recallMock).toHaveBeenNthCalledWith(3, expect.objectContaining({ threadId: 'thread-from-recall' }));
    });

    it('should reject threadId values outside the active resource', async () => {
      const tool = recallTool(undefined, { retrievalScope: 'resource' });
      const memory = {
        getThreadById: async ({ threadId }: { threadId: string }) => ({
          id: threadId,
          resourceId: 'other-resource',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
        }),
      };

      await expect(
        tool.execute?.(
          { mode: 'messages', threadId: 'thread-b' } as any,
          { memory, agent: { threadId: 'thread-a', resourceId: 'res-a' } } as any,
        ),
      ).rejects.toThrow('Thread does not belong to the active resource');
    });

    it('should resolve threadId="current" for mode="threads" in resource scope', async () => {
      const tool = recallTool(undefined, { retrievalScope: 'resource' });
      const getThreadById = vi.fn().mockResolvedValue({
        id: 'thread-a',
        resourceId: 'res-a',
        title: 'Current Thread',
        createdAt: new Date('2024-01-01T09:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z'),
      });

      const result = await tool.execute?.(
        { mode: 'threads', threadId: 'current' } as any,
        {
          memory: { getThreadById },
          agent: { threadId: 'thread-a', resourceId: 'res-a' },
        } as any,
      );

      expect(getThreadById).toHaveBeenCalledWith({ threadId: 'thread-a' });
      expect((result as any)?.count).toBe(1);
      expect((result as any)?.threads).toContain('Current Thread');
      expect((result as any)?.threads).toContain('← current');
    });

    it('should reject threadId="current" for mode="threads" when current thread is outside the active resource', async () => {
      const tool = recallTool(undefined, { retrievalScope: 'resource' });
      const getThreadById = vi.fn().mockResolvedValue({
        id: 'thread-a',
        resourceId: 'other-resource',
        title: 'Wrong Thread',
        createdAt: new Date('2024-01-01T09:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z'),
      });

      await expect(
        tool.execute?.(
          { mode: 'threads', threadId: 'current' } as any,
          {
            memory: { getThreadById },
            agent: { threadId: 'thread-a', resourceId: 'res-a' },
          } as any,
        ),
      ).rejects.toThrow('Thread does not belong to the active resource');
    });
  });

  describe('Memory.listTools with retrieval config shapes', () => {
    it('should register recall with retrieval: true (boolean)', () => {
      const memory = new Memory({
        storage: new InMemoryStore(),
        options: {
          observationalMemory: {
            model: 'test-model',
            scope: 'thread',
            retrieval: true, // backward compat boolean
          },
        } as any,
      });

      expect(memory.listTools()).toHaveProperty('recall');
    });

    it('should register recall with retrieval object config', () => {
      const memory = new Memory({
        storage: new InMemoryStore(),
        vector: { id: 'test' } as any,
        embedder: { specificationVersion: 'v3', modelId: 'test', doEmbed: async () => ({ embeddings: [] }) } as any,
        options: {
          observationalMemory: {
            model: 'test-model',
            scope: 'thread',
            retrieval: { vector: true }, // object config with vector search
          },
        } as any,
      });

      // recall tool should still be registered
      expect(memory.listTools()).toHaveProperty('recall');
    });
  });
});
