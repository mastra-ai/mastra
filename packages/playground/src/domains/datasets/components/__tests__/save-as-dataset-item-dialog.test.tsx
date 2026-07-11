import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ChangeEvent, HTMLAttributes, PropsWithChildren, ReactNode, SelectHTMLAttributes } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SaveAsDatasetItemDialog } from '../save-as-dataset-item-dialog';
import { buildListDatasetsResponse } from './fixtures/datasets';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

type CodeEditorProps = {
  value?: string;
  onChange?: (value: string) => void;
};

// @mastra/playground-ui is a heavy presentational dependency (SideDialog,
// CodeEditor, Select primitives) with its own dedicated tests; stub it as a
// thin seam so this suite can focus on the dialog's async-seeding logic. The
// data hooks below are driven through the real @mastra/client-js + React Query
// stack via MSW.
vi.mock('@mastra/playground-ui/components/Select', () => ({
  Select: ({ children }: PropsWithChildren<SelectHTMLAttributes<HTMLSelectElement>>) => <div>{children}</div>,
  SelectTrigger: ({ children }: PropsWithChildren<HTMLAttributes<HTMLButtonElement>>) => (
    <button type="button">{children}</button>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: PropsWithChildren) => <div>{children}</div>,
  SelectItem: ({ children }: PropsWithChildren<{ value: string }>) => <div>{children}</div>,
}));

vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@mastra/playground-ui/components/SideDialog', () => ({
  SideDialog: Object.assign(
    ({ isOpen, children }: PropsWithChildren<{ isOpen: boolean }>) => (isOpen ? <div>{children}</div> : null),
    {
      Top: ({ children }: PropsWithChildren) => <div>{children}</div>,
      Content: ({ children }: PropsWithChildren) => <div>{children}</div>,
      Header: ({ children }: PropsWithChildren) => <div>{children}</div>,
      Heading: ({ children }: PropsWithChildren) => <h2>{children}</h2>,
    },
  ),
}));

vi.mock('@mastra/playground-ui/components/CodeEditor', () => ({
  CodeEditor: ({ value, onChange }: CodeEditorProps) => (
    <textarea
      value={value ?? ''}
      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange?.(event.target.value)}
    />
  ),
}));

vi.mock('@mastra/playground-ui/components/Text', () => ({
  TextAndIcon: ({ children }: PropsWithChildren) => <span>{children}</span>,
}));

beforeEach(() => {
  server.use(http.get(`${BASE_URL}/api/datasets`, () => HttpResponse.json(buildListDatasetsResponse())));
});

afterEach(() => {
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

function getEditors() {
  return screen.getAllByRole('textbox') as HTMLTextAreaElement[];
}

describe('SaveAsDatasetItemDialog', () => {
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
});
