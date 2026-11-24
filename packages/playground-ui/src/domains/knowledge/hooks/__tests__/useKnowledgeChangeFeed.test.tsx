// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useKnowledgeChangeFeed } from '../useKnowledgeChangeFeed';
import type { KnowledgeChangeFeed } from '../useKnowledgeChangeFeed';

const GRAPH_READ_MS = 3_000;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** A Knowledge page with a graph query and an open change stream. The server finishes a read even if the tab drops it. */
function openKnowledgePage() {
  let announce = () => {};
  const feed: KnowledgeChangeFeed = {
    follow: (signal, { onConnected, onChange }) =>
      new Promise<void>(resolve => {
        announce = onChange;
        onConnected();
        signal.addEventListener('abort', () => resolve(), { once: true });
      }),
    isFinal: () => false,
    queries: { queryKey: ['knowledge'] },
  };
  const reads = { starts: [] as number[], running: 0, mostAtOnce: 0 };
  const readGraph = () => {
    reads.starts.push(Date.now());
    reads.running += 1;
    reads.mostAtOnce = Math.max(reads.mostAtOnce, reads.running);
    return new Promise<number>(resolve =>
      setTimeout(() => {
        reads.running -= 1;
        resolve(reads.starts.length);
      }, GRAPH_READ_MS),
    );
  };
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  renderHook(
    () => {
      useQuery({ queryKey: ['knowledge', 'graph'], queryFn: readGraph });
      return useKnowledgeChangeFeed(feed);
    },
    { wrapper },
  );
  return { reads, write: () => announce() };
}

const elapse = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

it('runs one graph read at a time, five seconds apart, while an agent writes every 200 ms', async () => {
  const page = openKnowledgePage();
  let lastWrite = 0;
  for (let elapsed = 0; elapsed < 20_000; elapsed += 200) {
    page.write();
    lastWrite = Date.now();
    await elapse(200);
  }
  await elapse(10_000);

  const gaps = page.reads.starts.slice(1).map((start, index) => start - page.reads.starts[index]);
  expect(page.reads.mostAtOnce).toBe(1);
  expect(Math.min(...gaps)).toBeGreaterThanOrEqual(5_000);
  expect(page.reads.starts.at(-1)).toBeGreaterThan(lastWrite);
});

it('reads the graph once for a burst of writes', async () => {
  const page = openKnowledgePage();
  await elapse(10_000);
  const before = page.reads.starts.length;

  for (let write = 0; write < 5; write++) {
    page.write();
    await elapse(20);
  }
  await elapse(10_000);

  expect(page.reads.starts.length).toBe(before + 1);
});
