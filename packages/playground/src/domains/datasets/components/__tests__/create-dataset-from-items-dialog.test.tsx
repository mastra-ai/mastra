// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { PropsWithChildren } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CreateDatasetFromItemsDialog } from '../create-dataset-from-items-dialog';
import { createdDataset, createdItem, sourceItemWithMocks } from './fixtures/create-dataset-from-items';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

// Thin stub for the heavy Dialog atom so this test focuses on the real client + mutation behavior.
vi.mock('@mastra/playground-ui/components/Dialog', () => {
  const Dialog = ({ open, children }: PropsWithChildren<{ open: boolean }>) => (open ? <div>{children}</div> : null);

  return {
    Dialog,
    DialogContent: ({ children }: PropsWithChildren) => <div>{children}</div>,
    DialogHeader: ({ children }: PropsWithChildren) => <div>{children}</div>,
    DialogTitle: ({ children }: PropsWithChildren) => <h2>{children}</h2>,
    DialogBody: ({ children }: PropsWithChildren) => <div>{children}</div>,
  };
});

vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderDialog() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <CreateDatasetFromItemsDialog open onOpenChange={vi.fn()} items={[sourceItemWithMocks]} />
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

describe('CreateDatasetFromItemsDialog', () => {
  it('copies tool mocks, expected trajectory, and request context to the new dataset', async () => {
    const addItemBodies: Array<Record<string, unknown>> = [];

    server.use(
      http.post(`${BASE_URL}/api/datasets`, () => HttpResponse.json(createdDataset)),
      http.post(`${BASE_URL}/api/datasets/:datasetId/items`, async ({ request }) => {
        addItemBodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(createdItem);
      }),
    );

    renderDialog();

    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Copied Dataset' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Dataset' }));

    await waitFor(() => expect(addItemBodies).toHaveLength(1));

    expect(addItemBodies[0]).toMatchObject({
      input: sourceItemWithMocks.input,
      groundTruth: sourceItemWithMocks.groundTruth,
      expectedTrajectory: sourceItemWithMocks.expectedTrajectory,
      toolMocks: sourceItemWithMocks.toolMocks,
      requestContext: sourceItemWithMocks.requestContext,
      metadata: sourceItemWithMocks.metadata,
    });
  });

  it('posts each copied item against the newly created dataset id', async () => {
    const itemDatasetIds: string[] = [];

    server.use(
      http.post(`${BASE_URL}/api/datasets`, () => HttpResponse.json(createdDataset)),
      http.post(`${BASE_URL}/api/datasets/:datasetId/items`, ({ params }) => {
        itemDatasetIds.push(params.datasetId as string);
        return HttpResponse.json(createdItem);
      }),
    );

    renderDialog();

    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Copied Dataset' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Dataset' }));

    await waitFor(() => expect(itemDatasetIds).toEqual(['ds-new']));
  });
});
