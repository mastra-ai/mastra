// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { useDatasetMutations } from '@mastra/react/hooks/datasets';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ChangeEvent, PropsWithChildren, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LinkComponentProvider } from '../../../../lib/framework';
import { Toaster, toast } from '../../../../lib/toast';
import { StubLink, stubLinkPaths } from '../../../../test/link-provider';
import { server } from '../../../../test/msw-server';
import { SaveAsDatasetItemDialog } from '../save-as-dataset-item-dialog';
import type { CreateDatasetDialogRenderProps } from '../save-as-dataset-item-dialog';
import { buildDataset, buildDatasetItem, buildListDatasetsResponse } from './fixtures/datasets';

const BASE_URL = 'http://localhost:4111';

type CodeEditorProps = {
  value?: string;
  onChange?: (value: string) => void;
};

// @mastra/playground-ui is a heavy presentational dependency (CodeEditor,
// Select primitives) with its own dedicated tests; stub it as a
// thin seam so this suite can focus on the dialog's async-seeding logic. The
// data hooks below are driven through the real @mastra/client-js + React Query
// stack via MSW. Select is a native <select> so tests can pick a dataset.
vi.mock('../../../../ds/components/Select', () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: PropsWithChildren<{ value?: string; onValueChange?: (value: string) => void }>) => (
    <select aria-label="Dataset" value={value} onChange={event => onValueChange?.(event.target.value)}>
      <option value="" />
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: PropsWithChildren) => <>{children}</>,
  SelectItem: ({ children, value }: PropsWithChildren<{ value: string }>) => <option value={value}>{children}</option>,
}));

vi.mock('../../../../ds/components/CodeEditor', () => ({
  CodeEditor: ({ value, onChange }: CodeEditorProps) => (
    <textarea
      value={value ?? ''}
      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange?.(event.target.value)}
    />
  ),
}));

beforeEach(() => {
  server.use(http.get(`${BASE_URL}/api/datasets`, () => HttpResponse.json(buildListDatasetsResponse())));
});

afterEach(() => {
  toast.dismiss();
  cleanup();
});

function noRetryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderDialog(props: Partial<Parameters<typeof SaveAsDatasetItemDialog>[0]> = {}) {
  const queryClient = noRetryClient();
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <SaveAsDatasetItemDialog
          initialInput="{}"
          initialGroundTruth=""
          breadcrumb={<span>Trace</span>}
          isOpen
          onClose={vi.fn()}
          {...props}
        />
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

function wrap(children: ReactNode) {
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={noRetryClient()}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
}

// Stands in for the app's create-dataset dialog: creates through the real mutation hook.
function StubCreateDatasetDialog({ open, onSuccess }: CreateDatasetDialogRenderProps) {
  const { createDataset } = useDatasetMutations();
  if (!open) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        const dataset = await createDataset.mutateAsync({ name: 'Fresh dataset' });
        onSuccess(dataset.id);
      }}
    >
      Create Dataset
    </button>
  );
}

function getEditors() {
  return screen.getAllByRole('textbox') as HTMLTextAreaElement[];
}

describe('SaveAsDatasetItemDialog', () => {
  describe('when the panel is open', () => {
    it('renders as a side panel dialog that closes from the header close button', async () => {
      const onClose = vi.fn();
      renderDialog({ onClose });

      expect(await screen.findByRole('dialog', { name: 'Save as Dataset Item' })).not.toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Close save as dataset item' }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the user creates a dataset from the Dataset select', () => {
    it('selects the new dataset once the dataset list includes it', async () => {
      let datasets = [buildDataset()];
      server.use(
        http.get(`${BASE_URL}/api/datasets`, () => HttpResponse.json(buildListDatasetsResponse(datasets))),
        http.post(`${BASE_URL}/api/datasets`, () => {
          const created = buildDataset({ id: 'dataset-new', name: 'Fresh dataset' });
          datasets = [created, ...datasets];
          return HttpResponse.json(created);
        }),
      );
      renderDialog({ renderCreateDatasetDialog: props => <StubCreateDatasetDialog {...props} /> });

      const createOption = (await screen.findByRole('option', { name: 'Create dataset' })) as HTMLOptionElement;
      const datasetSelect = screen.getByRole('combobox', { name: 'Dataset' }) as HTMLSelectElement;
      fireEvent.change(datasetSelect, { target: { value: createOption.value } });
      fireEvent.click(await screen.findByRole('button', { name: 'Create Dataset' }));

      await waitFor(() => expect(datasetSelect.value).toBe('dataset-new'));
      expect((screen.getByRole('button', { name: 'Save Item' }) as HTMLButtonElement).disabled).toBe(false);
    });
  });

  describe('when trace data arrives asynchronously after the dialog is already open', () => {
    it('hydrates the input, ground truth, and trajectory editors with the late values', async () => {
      const { rerender } = renderDialog();

      expect(getEditors()[0].value).toBe('{}');
      expect(getEditors()[1].value).toBe('');
      expect(getEditors()[2].value).toBe('');

      rerender(
        <MastraReactProvider baseUrl={BASE_URL}>
          <QueryClientProvider client={noRetryClient()}>
            <SaveAsDatasetItemDialog
              initialInput={'{"foo":1}'}
              initialGroundTruth={'{"answer":true}'}
              initialTrajectory={'{"steps":[]}'}
              breadcrumb={<span>Trace</span>}
              isOpen
              onClose={vi.fn()}
            />
          </QueryClientProvider>
        </MastraReactProvider>,
      );

      await waitFor(() => {
        expect(getEditors()[0].value).toBe('{"foo":1}');
        expect(getEditors()[1].value).toBe('{"answer":true}');
        expect(getEditors()[2].value).toBe('{"steps":[]}');
      });
    });
  });

  describe('when the user has edited fields before async trace data arrives', () => {
    it('preserves the user edits instead of overwriting them with the late values', async () => {
      const { rerender } = renderDialog();
      const [inputEditor, groundTruthEditor, trajectoryEditor] = getEditors();

      fireEvent.change(inputEditor, { target: { value: 'manual input' } });
      fireEvent.change(groundTruthEditor, { target: { value: 'manual ground truth' } });
      fireEvent.change(trajectoryEditor, { target: { value: 'manual trajectory' } });

      rerender(
        <MastraReactProvider baseUrl={BASE_URL}>
          <QueryClientProvider client={noRetryClient()}>
            <SaveAsDatasetItemDialog
              initialInput={'{"foo":1}'}
              initialGroundTruth={'{"answer":true}'}
              initialTrajectory={'{"steps":[]}'}
              breadcrumb={<span>Trace</span>}
              isOpen
              onClose={vi.fn()}
            />
          </QueryClientProvider>
        </MastraReactProvider>,
      );

      await waitFor(() => {
        expect(getEditors()[0].value).toBe('manual input');
        expect(getEditors()[1].value).toBe('manual ground truth');
        expect(getEditors()[2].value).toBe('manual trajectory');
      });
    });
  });

  describe('when the dialog is closed and then reopened with fresh values', () => {
    it('resets the user-edit guards so the next open seeds the new values', async () => {
      const { rerender } = renderDialog();
      const [inputEditor, groundTruthEditor, trajectoryEditor] = getEditors();

      fireEvent.change(inputEditor, { target: { value: 'manual input' } });
      fireEvent.change(groundTruthEditor, { target: { value: 'manual ground truth' } });
      fireEvent.change(trajectoryEditor, { target: { value: 'manual trajectory' } });

      rerender(
        <MastraReactProvider baseUrl={BASE_URL}>
          <QueryClientProvider client={noRetryClient()}>
            <SaveAsDatasetItemDialog
              initialInput="{}"
              initialGroundTruth=""
              breadcrumb={<span>Trace</span>}
              isOpen={false}
              onClose={vi.fn()}
            />
          </QueryClientProvider>
        </MastraReactProvider>,
      );

      rerender(
        <MastraReactProvider baseUrl={BASE_URL}>
          <QueryClientProvider client={noRetryClient()}>
            <SaveAsDatasetItemDialog
              initialInput={'{"next":2}'}
              initialGroundTruth={'{"expected":"next"}'}
              initialTrajectory={'{"steps":["next"]}'}
              breadcrumb={<span>Trace</span>}
              isOpen
              onClose={vi.fn()}
            />
          </QueryClientProvider>
        </MastraReactProvider>,
      );

      await waitFor(() => {
        expect(getEditors()[0].value).toBe('{"next":2}');
        expect(getEditors()[1].value).toBe('{"expected":"next"}');
        expect(getEditors()[2].value).toBe('{"steps":["next"]}');
      });
    });
  });

  it('renders a Tool Mocks editor and seeds it from initialToolMocks', () => {
    renderDialog({ initialToolMocks: '[{"toolName":"getWeather","args":{"city":"Seattle"},"output":{"temp":52}}]' });

    expect(screen.getByText('Tool Mocks (JSON, optional)')).not.toBeNull();
    // Editors: 0=input, 1=groundTruth, 2=trajectory, 3=toolMocks
    expect(getEditors()[3].value).toBe('[{"toolName":"getWeather","args":{"city":"Seattle"},"output":{"temp":52}}]');
  });

  it('seeds tool mocks from initialToolMocks when the dialog opens', async () => {
    const { rerender } = renderDialog({ isOpen: false });

    rerender(
      wrap(
        <SaveAsDatasetItemDialog
          initialInput="{}"
          initialGroundTruth=""
          initialToolMocks={'[{"toolName":"search","args":{},"output":"ok"}]'}
          breadcrumb={<span>Trace</span>}
          isOpen
          onClose={vi.fn()}
        />,
      ),
    );

    await waitFor(() => {
      expect(getEditors()[3].value).toBe('[{"toolName":"search","args":{},"output":"ok"}]');
    });
  });

  it('preserves user tool-mock edits across re-renders while the dialog stays open', async () => {
    const { rerender } = renderDialog({ initialToolMocks: '[{"toolName":"search","args":{},"output":"ok"}]' });

    fireEvent.change(getEditors()[3], { target: { value: 'manual mocks' } });

    // A benign re-render with the same props must not clobber the user's edit.
    rerender(
      wrap(
        <SaveAsDatasetItemDialog
          initialInput="{}"
          initialGroundTruth=""
          initialToolMocks={'[{"toolName":"search","args":{},"output":"ok"}]'}
          breadcrumb={<span>Trace</span>}
          isOpen
          onClose={vi.fn()}
        />,
      ),
    );

    await waitFor(() => {
      expect(getEditors()[3].value).toBe('manual mocks');
    });
  });

  describe('when the item is saved', () => {
    it('shows a toast with a Go to dataset action that opens the new item in its dataset', async () => {
      server.use(
        http.post(`${BASE_URL}/api/datasets/:datasetId/items`, ({ params }) =>
          HttpResponse.json(buildDatasetItem({ id: 'item-42', datasetId: String(params.datasetId) })),
        ),
      );
      const navigate = vi.fn<(path: string) => void>();

      render(
        wrap(
          <LinkComponentProvider Link={StubLink} navigate={navigate} paths={stubLinkPaths}>
            <Toaster />
            <SaveAsDatasetItemDialog
              initialInput={'{"question":"hi"}'}
              initialGroundTruth=""
              breadcrumb={<span>Trace</span>}
              isOpen
              onClose={vi.fn()}
            />
          </LinkComponentProvider>,
        ),
      );

      await screen.findByRole('option', { name: 'Dataset 1' });
      fireEvent.change(screen.getByRole('combobox', { name: 'Dataset' }), { target: { value: 'dataset-1' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Item' }));

      expect(await screen.findByText('Added to "Dataset 1"')).not.toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Go to dataset' }));

      expect(navigate).toHaveBeenCalledWith('/datasets/dataset-1/items/item-42');
    });

    it('omits the Go to dataset action when the app has no dataset item route', async () => {
      server.use(http.post(`${BASE_URL}/api/datasets/:datasetId/items`, () => HttpResponse.json(buildDatasetItem())));

      render(
        wrap(
          <LinkComponentProvider
            Link={StubLink}
            navigate={vi.fn()}
            paths={{ ...stubLinkPaths, datasetItemLink: () => '' }}
          >
            <Toaster />
            <SaveAsDatasetItemDialog
              initialInput={'{"question":"hi"}'}
              initialGroundTruth=""
              breadcrumb={<span>Trace</span>}
              isOpen
              onClose={vi.fn()}
            />
          </LinkComponentProvider>,
        ),
      );

      await screen.findByRole('option', { name: 'Dataset 1' });
      fireEvent.change(screen.getByRole('combobox', { name: 'Dataset' }), { target: { value: 'dataset-1' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Item' }));

      expect(await screen.findByText('Added to "Dataset 1"')).not.toBeNull();
      expect(screen.queryByRole('button', { name: 'Go to dataset' })).toBeNull();
    });
  });
});
