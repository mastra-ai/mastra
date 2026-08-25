// @vitest-environment jsdom
import type { GetWorkflowResponse } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useParams } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import CreateDatasetPage from '../index';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const emptyWorkflows: Record<string, GetWorkflowResponse> = {};

function DatasetProbe() {
  const { datasetId } = useParams();
  return <div data-testid="dataset-probe">{datasetId}</div>;
}

const renderPage = (initialEntry = '/datasets/new') => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/datasets/new" element={<CreateDatasetPage />} />
            <Route path="/datasets/:datasetId" element={<DatasetProbe />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

beforeEach(() => {
  server.use(http.get(`${BASE_URL}/api/workflows`, () => HttpResponse.json(emptyWorkflows)));
});

afterEach(() => cleanup());

describe('CreateDatasetPage', () => {
  it('shows the target-type picker for a generic (non-scoped) create', () => {
    renderPage();
    expect(screen.queryByText('Target type')).not.toBeNull();
  });

  it('hides the picker when the page is pre-scoped to a target via query params', () => {
    renderPage('/datasets/new?targetType=agent&targetIds=weather-agent');
    expect(screen.queryByText('Target type')).toBeNull();
  });

  it('ignores an invalid targetType query param and stays generic', () => {
    renderPage('/datasets/new?targetType=banana&targetIds=x');
    expect(screen.queryByText('Target type')).not.toBeNull();
  });

  it('sends targetType and targetIds from query params, then navigates to the new dataset', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.post(`${BASE_URL}/api/datasets`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          id: 'ds-new',
          name: 'My DS',
          version: 0,
          targetType: 'workflow',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }),
    );

    renderPage('/datasets/new?targetType=workflow&targetIds=my-wf,other-wf');

    fireEvent.change(screen.getByPlaceholderText('Enter dataset name'), { target: { value: 'My DS' } });
    fireEvent.click(screen.getByRole('button', { name: /create dataset/i }));

    await waitFor(() => expect(body?.targetType).toBe('workflow'));
    expect(body?.targetIds).toEqual(['my-wf', 'other-wf']);

    expect((await screen.findByTestId('dataset-probe')).textContent).toBe('ds-new');
  });
});
