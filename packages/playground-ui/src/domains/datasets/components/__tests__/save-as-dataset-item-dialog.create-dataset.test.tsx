// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { useDatasetMutations } from '@mastra/react/hooks/datasets';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ChangeEvent } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SaveAsDatasetItemDialog } from '../save-as-dataset-item-dialog';
import type { CreateDatasetDialogRenderProps } from '../save-as-dataset-item-dialog';
import { buildDataset, buildListDatasetsResponse } from './fixtures/datasets';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

// Unlike the main suite, this one keeps the real Select: Base UI resets an unmatched value when its
// items change, and that reset is what this suite guards against. CodeEditor stays stubbed.
vi.mock('@/ds/components/CodeEditor', () => ({
  CodeEditor: ({ value, onChange }: { value?: string; onChange?: (value: string) => void }) => (
    <textarea
      value={value ?? ''}
      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange?.(event.target.value)}
    />
  ),
}));

afterEach(() => {
  cleanup();
});

// Stands in for the app's create-dataset dialog: creates through the real mutation hook.
function StubCreateDatasetDialog({ open, onOpenChange, onSuccess }: CreateDatasetDialogRenderProps) {
  const { createDataset } = useDatasetMutations();
  if (!open) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        const dataset = await createDataset.mutateAsync({ name: 'Fresh dataset' });
        onOpenChange(false);
        onSuccess(dataset.id);
      }}
    >
      Create dataset
    </button>
  );
}

function pressOption(name: string) {
  const option = screen.getByRole('option', { name });
  fireEvent.pointerDown(option, { pointerType: 'mouse' });
  fireEvent.click(option, { detail: 1 });
}

describe('SaveAsDatasetItemDialog with the real Select', () => {
  describe('when the user creates a dataset from the Dataset select', () => {
    it('keeps the new dataset selected after the dataset list refetches', async () => {
      let datasets = [buildDataset()];
      server.use(
        http.get(`${BASE_URL}/api/datasets`, () => HttpResponse.json(buildListDatasetsResponse(datasets))),
        http.post(`${BASE_URL}/api/datasets`, () => {
          const created = buildDataset({ id: 'dataset-new', name: 'Fresh dataset' });
          datasets = [created, ...datasets];
          return HttpResponse.json(created);
        }),
      );
      render(
        <MastraReactProvider baseUrl={BASE_URL}>
          <QueryClientProvider
            client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}
          >
            <SaveAsDatasetItemDialog
              initialInput="{}"
              initialGroundTruth=""
              breadcrumb={<span>Trace</span>}
              isOpen
              onClose={vi.fn()}
              renderCreateDatasetDialog={props => <StubCreateDatasetDialog {...props} />}
            />
          </QueryClientProvider>
        </MastraReactProvider>,
      );

      const trigger = await screen.findByRole('combobox');
      await waitFor(() => expect(trigger.getAttribute('data-disabled')).toBeNull());
      fireEvent.click(trigger);
      await screen.findByRole('option', { name: 'Dataset 1' });
      pressOption('Create dataset');
      fireEvent.click(await screen.findByRole('button', { name: 'Create dataset' }));

      await waitFor(() => expect(trigger.textContent).toContain('Fresh dataset'));
      await waitFor(() =>
        expect((screen.getByRole('button', { name: 'Save item' }) as HTMLButtonElement).disabled).toBe(false),
      );
    });
  });
});
