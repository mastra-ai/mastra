import { act, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { useKnowledgeGraph, useKnowledgeLiveUpdates } from '../useKnowledgeGraph';

const PROJECT_ID = 'fp-1';
const KNOWLEDGE = `${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/knowledge`;
const GRAPH_READ_MS = 3_000;
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
  const graphReads = { started: 0, running: 0, mostAtOnce: 0, lastStartedAt: 0 };
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
      graphReads.started += 1;
      graphReads.running += 1;
      graphReads.mostAtOnce = Math.max(graphReads.mostAtOnce, graphReads.running);
      graphReads.lastStartedAt = Date.now();
      await delay(GRAPH_READ_MS);
      graphReads.running -= 1;
      return HttpResponse.json({ pages: [], edges: [], pinnedIds: [], truncated: false });
    }),
  );
  const { result } = renderHookWithProviders(() => {
    const live = useKnowledgeLiveUpdates(PROJECT_ID);
    useKnowledgeGraph(PROJECT_ID, false, live);
    return live;
  });
  await waitFor(() => expect(result.current).toBe(true));
  return {
    graphReads,
    write: () => stream?.enqueue(encoder.encode('event: change\ndata: {}\n\n')),
  };
}

it('reads the graph once when the page opens and the change stream connects during that read', async () => {
  const page = await openKnowledgePage();
  await elapse(3 * GRAPH_READ_MS);

  expect(page.graphReads.started).toBe(1);
});

it('reads the graph one read at a time while an agent writes, and once more after the last write', async () => {
  const page = await openKnowledgePage();
  await elapse(3 * GRAPH_READ_MS);
  let lastWriteAt = 0;

  for (let elapsed = 0; elapsed < 10_000; elapsed += WRITE_EVERY_MS) {
    page.write();
    lastWriteAt = Date.now();
    await elapse(WRITE_EVERY_MS);
  }
  await elapse(3 * GRAPH_READ_MS);

  expect(page.graphReads.mostAtOnce).toBe(1);
  expect(page.graphReads.lastStartedAt).toBeGreaterThan(lastWriteAt);
});
