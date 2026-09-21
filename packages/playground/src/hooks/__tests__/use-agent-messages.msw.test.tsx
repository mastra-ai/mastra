import type { MastraDBMessage } from '@mastra/core/agent/message-list';
import { act, cleanup, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useAgentMessages } from '../use-agent-messages';
import { server } from '@/test/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '@/test/render';

const MESSAGES_URL = `${TEST_BASE_URL}/api/memory/threads/:threadId/messages`;

const createdAt = (index: number) => new Date(1700000000000 + index * 1000);

const createMessage = (index: number, text = `Message ${index}`): MastraDBMessage => ({
  id: `msg-${index}`,
  role: 'user',
  createdAt: createdAt(index),
  content: { format: 2, parts: [{ type: 'text', text }] },
});

interface CursorRequest {
  end?: string;
}

const serveThread = (store: MastraDBMessage[], requests: CursorRequest[] = []) =>
  http.get(MESSAGES_URL, ({ request }) => {
    const url = new URL(request.url);
    const perPage = Number(url.searchParams.get('perPage'));
    const filter = JSON.parse(url.searchParams.get('filter') ?? 'null');
    requests.push({ end: filter?.dateRange?.end });

    const cutoff = filter?.dateRange?.end ? new Date(filter.dateRange.end).getTime() : Infinity;
    const older = store
      .filter(message => new Date(message.createdAt).getTime() <= cutoff)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || b.id.localeCompare(a.id));
    const page = older.slice(0, perPage).reverse();
    return HttpResponse.json({ messages: page, hasMore: older.length > perPage });
  });

const ids = (messages: MastraDBMessage[] | undefined) => messages?.map(message => message.id);

const range = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => `msg-${from + i}`);

const seed = (count: number) => Array.from({ length: count }, (_, i) => createMessage(i));

afterEach(() => cleanup());

describe('useAgentMessages', () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  it('walks older pages behind a createdAt cursor, oldest first, without duplicates', async () => {
    const requests: CursorRequest[] = [];
    server.use(serveThread(seed(90), requests));

    const { result } = renderHookWithProviders(() =>
      useAgentMessages({ threadId: 'thread-1', agentId: 'agent-1', memory: true }),
    );

    await waitFor(() => expect(ids(result.current.data?.messages)).toEqual(range(50, 90)));
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });
    // Inclusive cursor re-serves msg-50, so the page reaches msg-11 instead of msg-10.
    await waitFor(() => expect(ids(result.current.data?.messages)).toEqual(range(11, 90)));

    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(ids(result.current.data?.messages)).toEqual(range(0, 90)));
    expect(result.current.hasNextPage).toBe(false);

    expect(requests).toEqual([
      { end: undefined },
      { end: createdAt(50).toISOString() },
      { end: createdAt(11).toISOString() },
    ]);
  });

  describe('when messages at the page boundary share the same createdAt', () => {
    // Batch saves (user + assistant, tool call + result) land on one timestamp. With
    // 40 per page, msg-40..msg-45 all sit on createdAt(40): the newest page only has
    // room for msg-42..45, so an exclusive cursor would silently drop msg-40 and 41.
    const store = [
      ...seed(40),
      ...Array.from({ length: 6 }, (_, i) => ({ ...createMessage(40 + i), createdAt: createdAt(40) })),
      ...Array.from({ length: 10 }, (_, i) => createMessage(46 + i)),
    ];

    it('keeps every message and shows none twice', async () => {
      server.use(serveThread(store));

      const { result } = renderHookWithProviders(() =>
        useAgentMessages({ threadId: 'thread-1', agentId: 'agent-1', memory: true }),
      );
      await waitFor(() => expect(result.current.data?.messages).toHaveLength(40));

      await act(async () => {
        await result.current.fetchNextPage();
      });
      await waitFor(() => expect(result.current.hasNextPage).toBe(false));

      expect(ids(result.current.data?.messages)?.sort()).toEqual(range(0, 56).sort());
    });

    it('stops paging instead of re-requesting a full page of identical timestamps', async () => {
      const flat = Array.from({ length: 45 }, (_, i) => ({ ...createMessage(i), createdAt: createdAt(0) }));
      const requests: CursorRequest[] = [];
      server.use(serveThread(flat, requests));

      const { result } = renderHookWithProviders(() =>
        useAgentMessages({ threadId: 'thread-1', agentId: 'agent-1', memory: true }),
      );
      await waitFor(() => expect(result.current.data?.messages).toHaveLength(40));

      await act(async () => {
        await result.current.fetchNextPage();
      });
      await waitFor(() => expect(result.current.hasNextPage).toBe(false));

      expect(requests).toHaveLength(2);
    });
  });

  it('keeps older pages stable when new messages land at the end of the thread', async () => {
    const store = seed(60);
    server.use(serveThread(store));

    const { result } = renderHookWithProviders(() =>
      useAgentMessages({ threadId: 'thread-1', agentId: 'agent-1', memory: true }),
    );
    await waitFor(() => expect(ids(result.current.data?.messages)).toEqual(range(20, 60)));

    store.push(createMessage(60), createMessage(61));

    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(ids(result.current.data?.messages)).toEqual(range(0, 60)));
  });

  it('refreshes every loaded page when another feature invalidates the thread by prefix', async () => {
    const store = seed(60);
    const requests: CursorRequest[] = [];
    server.use(serveThread(store, requests));

    const { result, queryClient } = renderHookWithProviders(() =>
      useAgentMessages({ threadId: 'thread-1', agentId: 'agent-1', memory: true }),
    );
    await waitFor(() => expect(result.current.data?.messages).toHaveLength(40));
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.data?.messages).toHaveLength(60));

    store[0] = createMessage(0, 'Updated by the voice call');
    store[59] = createMessage(59, 'Updated by the voice call');
    requests.length = 0;

    // `useVoiceCall` refreshes the transcript with the thread prefix alone, so the
    // query key it never spells out in full still has to match.
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['memory', 'messages', 'thread-1'] });
    });

    expect(requests).toEqual([{ end: undefined }, { end: createdAt(20).toISOString() }]);
    await waitFor(() => {
      const messages = result.current.data?.messages ?? [];
      expect(ids(messages)).toEqual(range(0, 60));
      expect(messages[0]?.content.parts[0]).toMatchObject({ text: 'Updated by the voice call' });
      expect(messages[59]?.content.parts[0]).toMatchObject({ text: 'Updated by the voice call' });
    });
  });
});
