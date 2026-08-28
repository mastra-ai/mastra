// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ExperimentsList } from '../experiments-list';
import { experiments } from './fixtures/experiments';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const renderList = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TestLinkProvider>
          <ExperimentsList experiments={experiments} isLoading={false} />
        </TestLinkProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

afterEach(() => cleanup());

describe('ExperimentsList delete action', () => {
  it('renders a delete button for every row', () => {
    renderList();

    expect(screen.getByRole('button', { name: 'Delete experiment entity-extraction / model-a' })).toBeDefined();
    // Unnamed experiment falls back to its id in the accessible label.
    expect(
      screen.getByRole('button', { name: 'Delete experiment c0ffee00-0000-0000-0000-000000000003' }),
    ).toBeDefined();
  });

  it('opens a confirmation dialog and deletes the experiment via the top-level route', async () => {
    const onDelete = vi.fn<(experimentId: string | readonly string[] | undefined) => void>();
    server.use(
      http.delete(`${BASE_URL}/api/experiments/:experimentId`, ({ params }) => {
        onDelete(params.experimentId);
        return HttpResponse.json({ success: true });
      }),
    );

    renderList();

    fireEvent.click(screen.getByRole('button', { name: 'Delete experiment entity-extraction / model-a' }));

    // Confirmation dialog references the experiment by name.
    expect(await screen.findByText('Delete Experiment')).toBeDefined();
    expect(screen.getByText(/Are you sure you want to delete .entity-extraction \/ model-a./)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('a1b2c3d4-0000-0000-0000-000000000001'));
    // Dialog closes after a successful delete.
    await waitFor(() => expect(screen.queryByText('Delete Experiment')).toBeNull());
  });

  it('does not call the delete route when the dialog is cancelled', async () => {
    const onDelete = vi.fn();
    server.use(
      http.delete(`${BASE_URL}/api/experiments/:experimentId`, () => {
        onDelete();
        return HttpResponse.json({ success: true });
      }),
    );

    renderList();

    fireEvent.click(screen.getByRole('button', { name: 'Delete experiment entity-extraction / model-a' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByText('Delete Experiment')).toBeNull());
    expect(onDelete).not.toHaveBeenCalled();
  });
});
