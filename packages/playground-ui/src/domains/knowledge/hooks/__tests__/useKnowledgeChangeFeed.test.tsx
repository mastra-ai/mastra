// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { knowledgePollInterval, useKnowledgeChangeFeed } from '../useKnowledgeChangeFeed';
import type { KnowledgeChangeFeed } from '../useKnowledgeChangeFeed';

const GRAPH_READ_MS = 8_000;

let visibility: DocumentVisibilityState = 'visible';

beforeEach(() => {
  vi.useFakeTimers();
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
});
afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(document, 'visibilityState');
});

/** A Knowledge page with a polled graph query and an open change stream. The server finishes a read even if the tab drops it. */
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
  const reads = { starts: [] as number[], ends: [] as number[], running: 0, mostAtOnce: 0 };
  const readGraph = () => {
    const read = reads.starts.push(Date.now()) - 1;
    reads.running += 1;
    reads.mostAtOnce = Math.max(reads.mostAtOnce, reads.running);
    return new Promise<number>(resolve =>
      setTimeout(() => {
        reads.running -= 1;
        reads.ends[read] = Date.now();
        resolve(read);
      }, GRAPH_READ_MS),
    );
  };
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  renderHook(
    () => {
      const live = useKnowledgeChangeFeed(feed);
      useQuery({ queryKey: ['knowledge', 'graph'], queryFn: readGraph, refetchInterval: knowledgePollInterval(live) });
      return live;
    },
    { wrapper },
  );
  const setVisible = (shown: boolean) =>
    act(() => {
      visibility = shown ? 'visible' : 'hidden';
      document.dispatchEvent(new Event('visibilitychange'));
    });
  return { reads, write: () => announce(), setVisible };
}

const elapse = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const SETTLED_MS = 30_000;

it('runs one graph read at a time, each five seconds after the last ended, while an agent writes every 200 ms', async () => {
  const page = openKnowledgePage();
  await elapse(SETTLED_MS);
  const settled = page.reads.starts.length;
  let lastWrite = 0;
  for (let elapsed = 0; elapsed < 20_000; elapsed += 200) {
    page.write();
    lastWrite = Date.now();
    await elapse(200);
  }
  await elapse(15_000);

  const rests = page.reads.starts.slice(settled).map((start, index) => start - page.reads.ends[settled + index - 1]);
  expect(page.reads.mostAtOnce).toBe(1);
  expect(rests.length).toBeGreaterThan(1);
  expect(Math.min(...rests)).toBeGreaterThanOrEqual(5_000);
  expect(page.reads.starts.at(-1)).toBeGreaterThan(lastWrite);
});

it('waits for a poll already reading the graph, then reads it again, when a write arrives', async () => {
  const page = openKnowledgePage();
  await elapse(SETTLED_MS);
  const settled = page.reads.starts.length;
  for (let waited = 0; page.reads.running === 0 && waited < 2 * knowledgePollInterval(true); waited += 1_000) {
    await elapse(1_000);
  }
  expect(page.reads.starts.length).toBe(settled + 1);
  expect(page.reads.running).toBe(1);
  const pollStarted = page.reads.starts.at(-1) ?? 0;

  page.write();
  await elapse(SETTLED_MS);

  expect(page.reads.mostAtOnce).toBe(1);
  expect(page.reads.starts.at(-1)).toBeGreaterThanOrEqual(pollStarted + GRAPH_READ_MS);
});

it('does not start a second graph read when the tab is hidden and shown again mid-read', async () => {
  const page = openKnowledgePage();
  await elapse(SETTLED_MS);
  page.write();
  await elapse(2_000);
  expect(page.reads.running).toBe(1);

  page.setVisible(false);
  await elapse(500);
  page.setVisible(true);
  await elapse(SETTLED_MS);

  expect(page.reads.mostAtOnce).toBe(1);
});

it('reads the graph once for a burst of writes', async () => {
  const page = openKnowledgePage();
  await elapse(SETTLED_MS);
  const before = page.reads.starts.length;

  for (let write = 0; write < 5; write++) {
    page.write();
    await elapse(20);
  }
  await elapse(SETTLED_MS);

  expect(page.reads.starts.length).toBe(before + 1);
});
