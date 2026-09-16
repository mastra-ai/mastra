// @vitest-environment jsdom
import type { GetWorkflowResponse } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Route, Routes, useParams } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import EditDatasetPage from '../index';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const emptyWorkflows: Record<string, GetWorkflowResponse> = {};

const baseDataset = {
  id: 'ds-1',
  name: 'My DS',
  description: 'Old description',
  version: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function DatasetProbe() {
  const { datasetId } = useParams();
  return <div data-testid="dataset-probe">{datasetId}</div>;
}

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/datasets/ds-1/edit']}>
          <Routes>
            <Route path="/datasets/:datasetId/edit" element={<EditDatasetPage />} />
            <Route path="/datasets/:datasetId" element={<DatasetProbe />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

beforeEach(() => {
  server.use(
    http.get(`${BASE_URL}/api/workflows`, () => HttpResponse.json(emptyWorkflows)),
    http.get(`${BASE_URL}/api/datasets/ds-1`, () => HttpResponse.json(baseDataset)),
  );
});

afterEach(() => cleanup());

describe('EditDatasetPage', () => {
  it('pre-fills the form with the loaded dataset', async () => {
    renderPage();

    const nameInput = await screen.findByLabelText<HTMLInputElement>(/^Name/);
    expect(nameInput.value).toBe('My DS');
    expect(screen.getByLabelText<HTMLInputElement>('Description').value).toBe('Old description');
  });

  it('saves changes via PATCH and navigates back to the dataset page', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.patch(`${BASE_URL}/api/datasets/ds-1`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...baseDataset, name: 'Renamed DS' });
      }),
    );

    renderPage();

    const nameInput = await screen.findByLabelText(/^Name/);
    fireEvent.change(nameInput, { target: { value: 'Renamed DS' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(body?.name).toBe('Renamed DS'));
    expect((await screen.findByTestId('dataset-probe')).textContent).toBe('ds-1');
  });

  it('navigates back to the dataset page on Cancel', async () => {
    renderPage();

    await screen.findByLabelText(/^Name/);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect((await screen.findByTestId('dataset-probe')).textContent).toBe('ds-1');
  });

  it('shows a validation message when existing items fail the new schema', async () => {
    server.use(
      http.patch(`${BASE_URL}/api/datasets/ds-1`, () =>
        HttpResponse.json(
          { message: 'Validation failed', cause: { failingItems: [{ id: 'item-1' }, { id: 'item-2' }] } },
          { status: 400 },
        ),
      ),
    );

    renderPage();

    await screen.findByLabelText(/^Name/);
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText(/2 existing item\(s\) fail validation/i)).toBeDefined();
    // Stays on the edit page so the user can fix the schema
    expect(screen.queryByTestId('dataset-probe')).toBeNull();
  });
});
