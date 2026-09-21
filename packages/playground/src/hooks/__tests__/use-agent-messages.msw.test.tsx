import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { act, cleanup, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAgentMessages } from '../use-agent-messages';
import { server } from '@/test/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '@/test/render';

const MESSAGES_URL = `${TEST_BASE_URL}/api/memory/threads/:threadId/messages`;

const createMessage = (index: number, text?: string): MastraDBMessage => ({
  id: `msg-${index}`,
  role: 'user',
  createdAt: new Date(1700000000000 + index * 1000),
  content: {
    format: 2,
    parts: [{ type: 'text', text: text ?? `Message ${index}` }],
  },
});

afterEach(() => cleanup());

describe('useAgentMessages', () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  it('refetches all loaded pages in order (2, 1, 0) and maintains chronological ordering without duplicates', async () => {
    // 1. Mock 120 messages across three pages of 40:
    // Page 0 (newest messages): 80..119
    // Page 1 (older messages): 40..79
    // Page 2 (oldest messages): 0..39
    const messagesPage0: MastraDBMessage[] = Array.from({ length: 40 }, (_, i) => createMessage(80 + i));
    const messagesPage1: MastraDBMessage[] = Array.from({ length: 40 }, (_, i) => createMessage(40 + i));
    const messagesPage2: MastraDBMessage[] = Array.from({ length: 40 }, (_, i) => createMessage(i));

    const pageRequests: number[] = [];

    server.use(
      http.get(MESSAGES_URL, ({ request }) => {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '0', 10);
        pageRequests.push(page);

        if (page === 0) {
          return HttpResponse.json({
            messages: messagesPage0,
            page: 0,
            perPage: 40,
            total: 120,
            hasMore: true,
          });
        }
        if (page === 1) {
          return HttpResponse.json({
            messages: messagesPage1,
            page: 1,
            perPage: 40,
            total: 120,
            hasMore: true,
          });
        }
        if (page === 2) {
          return HttpResponse.json({
            messages: messagesPage2,
            page: 2,
            perPage: 40,
            total: 120,
            hasMore: false,
          });
        }
        return HttpResponse.json({ messages: [], hasMore: false });
      }),
    );

    // 2. Mount the hook and call fetchPreviousPage() twice, waiting for each request to finish.
    const { result } = renderHookWithProviders(() =>
      useAgentMessages({
        threadId: 'thread-1',
        agentId: 'agent-1',
        memory: true,
      }),
    );

    // Wait for initial page 0 to load
    await waitFor(() => {
      expect(result.current.data?.messages).toHaveLength(40);
    });
    expect(result.current.hasPreviousPage).toBe(true);

    // Fetch page 1 (older)
    await act(async () => {
      await result.current.fetchPreviousPage();
    });
    await waitFor(() => {
      expect(result.current.data?.messages).toHaveLength(80);
    });

    // Fetch page 2 (oldest)
    await act(async () => {
      await result.current.fetchPreviousPage();
    });
    await waitFor(() => {
      expect(result.current.data?.messages).toHaveLength(120);
    });

    // 3. Check that all 120 messages appear in chronological order (0 to 119).
    const initialIds = result.current.data?.messages.map(m => m.id);
    const expectedIds = Array.from({ length: 120 }, (_, i) => `msg-${i}`);
    expect(initialIds).toEqual(expectedIds);

    // 4. Change one message’s content on each mocked page, keeping IDs and ordering unchanged.
    messagesPage0[0] = createMessage(80, 'Updated message 80');
    messagesPage1[0] = createMessage(40, 'Updated message 40');
    messagesPage2[0] = createMessage(0, 'Updated message 0');

    // Reset request tracking before calling refetch
    pageRequests.length = 0;

    // 5. Call the hook’s refetch().
    await act(async () => {
      await result.current.refetch();
    });

    // 6. Check assertions:
    // - The refetch requests pages 2, 1, and 0, in that order.
    expect(pageRequests).toEqual([2, 1, 0]);

    // - All 120 messages remain in the same order, with no duplicates.
    const refetchedIds = result.current.data?.messages.map(m => m.id);
    expect(refetchedIds).toEqual(expectedIds);
    expect(new Set(refetchedIds).size).toBe(120);

    // - All three updated messages appear.
    await waitFor(() => {
      const message0 = result.current.data?.messages.find(m => m.id === 'msg-0');
      const message40 = result.current.data?.messages.find(m => m.id === 'msg-40');
      const message80 = result.current.data?.messages.find(m => m.id === 'msg-80');

      expect(message0?.content?.parts?.[0]?.text).toBe('Updated message 0');
      expect(message40?.content?.parts?.[0]?.text).toBe('Updated message 40');
      expect(message80?.content?.parts?.[0]?.text).toBe('Updated message 80');
    });
  });

  it('refreshes every loaded page when another feature invalidates the thread by prefix', async () => {
    const pages = [
      Array.from({ length: 40 }, (_, i) => createMessage(80 + i)),
      Array.from({ length: 40 }, (_, i) => createMessage(40 + i)),
      Array.from({ length: 40 }, (_, i) => createMessage(i)),
    ];
    const pageRequests: number[] = [];

    server.use(
      http.get(MESSAGES_URL, ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page') ?? '0');
        pageRequests.push(page);
        return HttpResponse.json({
          messages: pages[page] ?? [],
          page,
          perPage: 40,
          total: 120,
          hasMore: page < 2,
        });
      }),
    );

    const { result, queryClient } = renderHookWithProviders(() =>
      useAgentMessages({ threadId: 'thread-1', agentId: 'agent-1', memory: true }),
    );

    await waitFor(() => expect(result.current.data?.messages).toHaveLength(40));
    await act(async () => {
      await result.current.fetchPreviousPage();
    });
    await act(async () => {
      await result.current.fetchPreviousPage();
    });
    await waitFor(() => expect(result.current.data?.messages).toHaveLength(120));

    pages[2][0] = createMessage(0, 'Updated by the voice call');
    pageRequests.length = 0;

    // `useVoiceCall` refreshes the transcript with the thread prefix alone, so the
    // query key it never spells out in full still has to match.
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['memory', 'messages', 'thread-1'] });
    });

    expect(pageRequests).toEqual([2, 1, 0]);
    await waitFor(() =>
      expect(result.current.data?.messages.find(m => m.id === 'msg-0')?.content?.parts?.[0]?.text).toBe(
        'Updated by the voice call',
      ),
    );
    const ids = result.current.data?.messages.map(m => m.id);
    expect(ids).toEqual(Array.from({ length: 120 }, (_, i) => `msg-${i}`));
  });
});
