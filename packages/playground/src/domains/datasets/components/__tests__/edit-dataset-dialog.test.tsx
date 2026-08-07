import type { GetWorkflowResponse } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EditDatasetDialog } from '../edit-dataset-dialog';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const baseDataset = { id: 'ds-1', name: 'My DS', description: '' };

// SchemaConfigSection fetches workflows whenever the dialog is open.
const emptyWorkflows: Record<string, GetWorkflowResponse> = {};

beforeEach(() => {
  server.use(http.get(`${BASE_URL}/api/workflows`, () => HttpResponse.json(emptyWorkflows)));
});

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

// Mirrors how the dataset detail page drives the dialog: controlled `open`
// state toggled by the dialog's own onOpenChange.
function ControlledDialogHarness({
  dataset = baseDataset,
}: {
  dataset?: ComponentProps<typeof EditDatasetDialog>['dataset'];
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <ControlledDialog dataset={dataset} />
      </QueryClientProvider>
    </MastraReactProvider>
  );
}

function ControlledDialog({ dataset }: { dataset: ComponentProps<typeof EditDatasetDialog>['dataset'] }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Reopen
      </button>
      <EditDatasetDialog open={open} onOpenChange={setOpen} dataset={dataset} />
    </>
  );
}

describe('EditDatasetDialog dismissal', () => {
  // https://github.com/mastra-ai/mastra/issues/17890
  it('unmounts the dialog when Cancel is clicked', async () => {
    render(<ControlledDialogHarness />);

    expect(screen.getByRole('dialog')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('unmounts the dialog when the built-in close button is clicked', async () => {
    render(<ControlledDialogHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('discards unsaved edits when the dialog is reopened', async () => {
    render(<ControlledDialogHarness />);

    fireEvent.change(screen.getByLabelText('Name *'), { target: { value: 'Dirty edit' } });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));

    const nameInput = await screen.findByLabelText<HTMLInputElement>('Name *');
    expect(nameInput.value).toBe('My DS');
  });

  it('unmounts the dialog after a successful save', async () => {
    server.use(
      http.patch(`${BASE_URL}/api/datasets/ds-1`, () =>
        HttpResponse.json({
          id: 'ds-1',
          name: 'My DS',
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      ),
    );

    render(<ControlledDialogHarness />);

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

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
