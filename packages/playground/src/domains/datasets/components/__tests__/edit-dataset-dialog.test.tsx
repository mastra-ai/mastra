// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EditDatasetDialog } from '../edit-dataset-dialog';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const baseDataset = { id: 'ds-1', name: 'My DS', description: '' };

const renderDialog = (props: Partial<ComponentProps<typeof EditDatasetDialog>> = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <EditDatasetDialog open onOpenChange={vi.fn()} dataset={baseDataset} {...props} />
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

afterEach(() => cleanup());

describe('EditDatasetDialog target type', () => {
  it('exposes a target-type field so existing (untyped) datasets can be classified', () => {
    renderDialog();
    expect(screen.queryByText('Target type')).not.toBeNull();
  });

  it('persists the dataset target type via PATCH on save', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.patch(`${BASE_URL}/api/datasets/ds-1`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          id: 'ds-1',
          name: 'My DS',
          version: 1,
          targetType: 'agent',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }),
    );

    renderDialog({ dataset: { ...baseDataset, targetType: 'agent' } });

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(body?.targetType).toBe('agent'));
  });
});
