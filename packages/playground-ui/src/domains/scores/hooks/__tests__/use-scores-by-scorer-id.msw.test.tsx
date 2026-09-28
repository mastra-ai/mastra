// @vitest-environment jsdom
import type { ListScoresResponse } from '@mastra/client-js';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useScoresByScorerId } from '../use-scorers';
import { server } from '@/test/msw-server';
import { makeWrapper } from '@/test/render';

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];
  constructor(private readonly callback: IntersectionObserverCallback) {
    MockIntersectionObserver.instances.push(this);
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
  trigger(isIntersecting: boolean) {
    this.callback([{ isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

const makeScore = (id: string) =>
  ({
    id,
    scorerId: 'scorer-1',
    entityId: 'agent-1',
    runId: `run-${id}`,
    score: 1,
    scorer: {},
    source: 'LIVE',
    entity: {},
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  }) as ListScoresResponse['scores'][number];

beforeEach(() => {
  MockIntersectionObserver.instances = [];
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('useScoresByScorerId', () => {
  it('loads the first page, then the next page once the end of the list is in view', async () => {
    const pages: string[] = [];
    server.use(
      http.get('*/api/scores/scorer/scorer-1', ({ request }) => {
        const page = new URL(request.url).searchParams.get('page') ?? '0';
        pages.push(page);
        const response: ListScoresResponse = {
          scores: [makeScore(`score-${page}`)],
          pagination: { total: 2, page: Number(page), perPage: 25, hasMore: page === '0' },
        };
        return HttpResponse.json(response);
      }),
    );

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useScoresByScorerId({ scorerId: 'scorer-1' }), { wrapper });

    await waitFor(() => expect(result.current.data?.map(s => s.id)).toEqual(['score-0']));
    expect(pages).toEqual(['0']);

    act(() => result.current.setEndOfListElement(document.createElement('div')));
    await waitFor(() => expect(MockIntersectionObserver.instances.length).toBeGreaterThan(0));
    act(() => MockIntersectionObserver.instances.at(-1)?.trigger(true));

    await waitFor(() => expect(result.current.data?.map(s => s.id)).toEqual(['score-0', 'score-1']));
    expect(result.current.hasNextPage).toBe(false);
  });
});
