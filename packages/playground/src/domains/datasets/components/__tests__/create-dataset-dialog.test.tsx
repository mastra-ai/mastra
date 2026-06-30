import type { GetWorkflowResponse } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CreateDatasetDialog } from '../create-dataset-dialog';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const emptyWorkflows: Record<string, GetWorkflowResponse> = {};

const renderDialog = (props: Partial<ComponentProps<typeof CreateDatasetDialog>> = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <CreateDatasetDialog open onOpenChange={vi.fn()} {...props} />
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

beforeEach(() => {
  server.use(http.get(`${BASE_URL}/api/workflows`, () => HttpResponse.json(emptyWorkflows)));
});

afterEach(() => cleanup());

describe('CreateDatasetDialog target type', () => {
  it('shows the target-type picker for a generic (non-scoped) create', () => {
    renderDialog();
    expect(screen.queryByText('Target type')).not.toBeNull();
  });

  it('hides the picker when the dialog is pre-scoped to a target via props', () => {
    renderDialog({ targetType: 'agent', targetIds: ['weather-agent'] });
    expect(screen.queryByText('Target type')).toBeNull();
  });

  it('sends targetType (and targetIds) to the create endpoint so the dataset is classified', async () => {
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

    renderDialog({ targetType: 'workflow', targetIds: ['my-wf'] });

    fireEvent.change(screen.getByPlaceholderText('Enter dataset name'), { target: { value: 'My DS' } });
    fireEvent.click(screen.getByRole('button', { name: /create dataset/i }));

    await waitFor(() => expect(body?.targetType).toBe('workflow'));
    expect(body?.targetIds).toEqual(['my-wf']);
  });
});
