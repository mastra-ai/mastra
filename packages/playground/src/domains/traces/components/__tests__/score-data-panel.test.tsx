// @vitest-environment jsdom
import type { DatasetRecord } from '@mastra/client-js';
import type { ScoreRowData } from '@mastra/core/evals';
import type { PaginationInfo } from '@mastra/core/storage';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ScoreDataPanel } from '../score-data-panel';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const emptyDatasets: { datasets: DatasetRecord[]; pagination: PaginationInfo } = {
  datasets: [],
  pagination: { total: 0, page: 0, perPage: 50, hasMore: false },
};

function buildScore(overrides: Partial<ScoreRowData> = {}): ScoreRowData {
  return {
    id: 'score-1',
    scorerId: 'my-scorer',
    entityId: 'my-agent',
    runId: 'run-1',
    output: { text: 'hello' },
    score: 0.9,
    scorer: { name: 'my-scorer', hasJudge: false },
    source: 'LIVE',
    entity: { id: 'my-agent' },
    entityType: 'AGENT',
    createdAt: new Date('2026-08-20T00:00:00Z'),
    updatedAt: new Date('2026-08-20T00:00:00Z'),
    ...overrides,
  };
}

const renderPanel = (score: ScoreRowData) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TestLinkProvider>
          <ScoreDataPanel score={score} onClose={() => {}} />
        </TestLinkProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

beforeEach(() => {
  server.use(http.get(`${BASE_URL}/api/datasets`, () => HttpResponse.json(emptyDatasets)));
});

afterEach(() => cleanup());

describe('ScoreDataPanel thread drill-down', () => {
  it('links an agent score with a threadId to the conversation view', () => {
    renderPanel(buildScore({ threadId: 'thread-42' }));

    const link = screen.getByRole('link', { name: 'thread-42' });
    expect(link.getAttribute('href')).toBe('/agents/my-agent/chat/thread-42');
  });

  it('renders the threadId as plain text for thread-scoped scores without an agent', () => {
    renderPanel(buildScore({ threadId: 'thread-42', entityType: 'THREAD', entityId: 'thread-42' }));

    expect(screen.queryByRole('link', { name: 'thread-42' })).toBeNull();
    expect(screen.getByText('thread-42')).not.toBeNull();
  });

  it('does not render a thread row when the score has no threadId', () => {
    renderPanel(buildScore());

    expect(screen.queryByText('Thread Id')).toBeNull();
  });
});
