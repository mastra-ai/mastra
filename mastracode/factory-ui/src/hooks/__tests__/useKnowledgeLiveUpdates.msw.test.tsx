import { act, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { queryKeys } from '../../api/keys';
import { useKnowledgeGraph, useKnowledgeLiveUpdates, useKnowledgeSearch } from '../useKnowledgeGraph';

const PROJECT_ID = 'fp-1';
const KNOWLEDGE = `${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/knowledge`;
const READ_MS = 3_000;
const WRITE_EVERY_MS = 200;
const STREAM_CONNECT_MS = 100;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

const elapse = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

async function openKnowledgePage() {
  const encoder = new TextEncoder();
  let stream: ReadableStreamDefaultController<Uint8Array> | undefined;
  let writes = 0;
  const graphReads = { started: 0, running: 0, mostAtOnce: 0 };
  server.use(
    http.get(`${KNOWLEDGE}/events`, async () => {
      await delay(STREAM_CONNECT_MS);
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            stream = controller;
          },
        }),
        { headers: { 'content-type': 'text/event-stream' } },
      );
    }),
    http.get(`${KNOWLEDGE}/graph`, async () => {
      const written = writes;
      graphReads.started += 1;
      graphReads.running += 1;
      graphReads.mostAtOnce = Math.max(graphReads.mostAtOnce, graphReads.running);
      await delay(READ_MS);
      graphReads.running -= 1;
      const pinnedIds = Array.from({ length: written }, (_, index) => `page-${index}`);
      return HttpResponse.json({ pages: [], edges: [], pinnedIds, truncated: false });
    }),
    http.get(`${KNOWLEDGE}/search`, async () => {
      const written = writes;
      await delay(READ_MS);
      const results = Array.from({ length: written }, (_, index) => ({ page: { id: `page-${index}` } }));
      return HttpResponse.json({ results });
    }),
  );
  const { result, rerender, client } = renderHookWithProviders(
    ({ search }: { search: string }) => {
      const live = useKnowledgeLiveUpdates(PROJECT_ID);
      return {
        live,
        graph: useKnowledgeGraph(PROJECT_ID, false, live),
        search: useKnowledgeSearch(PROJECT_ID, search),
      };
    },
    { initialProps: { search: '' } },
  );
  await waitFor(() => expect(result.current.live).toBe(true));
  return {
    graphReads,
    pagesInGraph: () => result.current.graph.data?.pinnedIds.length,
    pagesFound: () => result.current.search.data?.results.length,
    search: (text: string) => rerender({ search: text }),
    pollGraph: () => void client.refetchQueries({ queryKey: queryKeys.knowledgeGraph(PROJECT_ID) }),
    write: () => {
      writes += 1;
      stream?.enqueue(encoder.encode('event: change\ndata: {}\n\n'));
    },
  };
}

it('reads the graph once when the page opens and the change stream connects during that read', async () => {
  const page = await openKnowledgePage();
  await elapse(3 * READ_MS);

  expect(page.graphReads.started).toBe(1);
});

it('keeps showing newer graphs while an agent writes, one read at a time, and ends on the last write', async () => {
  const page = await openKnowledgePage();
  await elapse(3 * READ_MS);
  let written = 0;

  for (let elapsed = 0; elapsed < 10_000; elapsed += WRITE_EVERY_MS) {
    page.write();
    written += 1;
    await elapse(WRITE_EVERY_MS);
  }
  const shownWhileWriting = page.pagesInGraph();
  await elapse(3 * READ_MS);

  expect(page.graphReads.mostAtOnce).toBe(1);
  expect(shownWhileWriting).toBeGreaterThan(0);
  expect(page.pagesInGraph()).toBe(written);
});

it('shows a write that lands while a poll reads the graph', async () => {
  const page = await openKnowledgePage();
  await elapse(3 * READ_MS);

  page.pollGraph();
  await elapse(READ_MS / 2);
  page.write();
  await elapse(3 * READ_MS);

  expect(page.pagesInGraph()).toBe(1);
});

it('shows a write that lands while a new search loads', async () => {
  const page = await openKnowledgePage();
  await elapse(3 * READ_MS);

  page.search('deploy');
  await elapse(READ_MS / 2);
  page.write();
  await elapse(3 * READ_MS);

  expect(page.pagesFound()).toBe(1);
});
