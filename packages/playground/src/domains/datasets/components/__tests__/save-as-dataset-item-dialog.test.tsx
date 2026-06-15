// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ButtonHTMLAttributes, ChangeEvent, HTMLAttributes, PropsWithChildren, SelectHTMLAttributes } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SaveAsDatasetItemDialog } from '../save-as-dataset-item-dialog';

type CodeEditorProps = {
  value?: string;
  onChange?: (value: string) => void;
};

vi.mock('@mastra/playground-ui', () => {
  const SideDialogRoot = ({ isOpen, children }: PropsWithChildren<{ isOpen: boolean }>) =>
    isOpen ? <div>{children}</div> : null;

  const SideDialog = Object.assign(SideDialogRoot, {
    Top: ({ children }: PropsWithChildren) => <div>{children}</div>,
    Content: ({ children }: PropsWithChildren) => <div>{children}</div>,
    Header: ({ children }: PropsWithChildren) => <div>{children}</div>,
    Heading: ({ children }: PropsWithChildren) => <h2>{children}</h2>,
  });

  return {
    Button: ({ variant: _variant, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) => (
      <button {...props} />
    ),
    CodeEditor: ({ value, onChange }: CodeEditorProps) => (
      <textarea
        value={value ?? ''}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange?.(event.target.value)}
      />
    ),
    Label: ({ children, ...props }: PropsWithChildren<HTMLAttributes<HTMLLabelElement>>) => (
      <label {...props}>{children}</label>
    ),
    Select: ({ children }: PropsWithChildren<SelectHTMLAttributes<HTMLSelectElement>>) => <div>{children}</div>,
    SelectTrigger: ({ children }: PropsWithChildren<HTMLAttributes<HTMLButtonElement>>) => (
      <button type="button">{children}</button>
    ),
    SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
    SelectContent: ({ children }: PropsWithChildren) => <div>{children}</div>,
    SelectItem: ({ children }: PropsWithChildren<{ value: string }>) => <div>{children}</div>,
    SideDialog,
    TextAndIcon: ({ children }: PropsWithChildren) => <span>{children}</span>,
    toast: { error: vi.fn(), success: vi.fn() },
  };
});

vi.mock('@/domains/datasets/hooks/use-datasets', () => ({
  useDatasets: () => ({
    data: { datasets: [{ id: 'dataset-1', name: 'Dataset 1' }] },
    isLoading: false,
  }),
}));

vi.mock('@/domains/datasets/hooks/use-dataset-mutations', () => ({
  useDatasetMutations: () => ({
    addItem: {
      isPending: false,
      mutateAsync: vi.fn(),
    },
  }),
}));

afterEach(() => {
  cleanup();
});

function renderDialog(props: Partial<Parameters<typeof SaveAsDatasetItemDialog>[0]> = {}) {
  return render(
    <SaveAsDatasetItemDialog
      initialInput="{}"
      initialGroundTruth=""
      breadcrumb={<span>Trace</span>}
      isOpen
      onClose={vi.fn()}
      {...props}
    />,
  );
}

function getEditors() {
  return screen.getAllByRole('textbox') as HTMLTextAreaElement[];
}

describe('SaveAsDatasetItemDialog async seeding', () => {
  it('hydrates input, ground truth, and trajectory when async trace data arrives after opening', async () => {
    const { rerender } = renderDialog();

    expect(getEditors()[0].value).toBe('{}');
    expect(getEditors()[1].value).toBe('');
    expect(getEditors()[2].value).toBe('');

    rerender(
      <SaveAsDatasetItemDialog
        initialInput={'{"foo":1}'}
        initialGroundTruth={'{"answer":true}'}
        initialTrajectory={'{"steps":[]}'}
        breadcrumb={<span>Trace</span>}
        isOpen
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(getEditors()[0].value).toBe('{"foo":1}');
      expect(getEditors()[1].value).toBe('{"answer":true}');
      expect(getEditors()[2].value).toBe('{"steps":[]}');
    });
  });

  it('preserves user edits when async trace data arrives later', async () => {
    const { rerender } = renderDialog();
    const [inputEditor, groundTruthEditor, trajectoryEditor] = getEditors();

    fireEvent.change(inputEditor, { target: { value: 'manual input' } });
    fireEvent.change(groundTruthEditor, { target: { value: 'manual ground truth' } });
    fireEvent.change(trajectoryEditor, { target: { value: 'manual trajectory' } });

    rerender(
      <SaveAsDatasetItemDialog
        initialInput={'{"foo":1}'}
        initialGroundTruth={'{"answer":true}'}
        initialTrajectory={'{"steps":[]}'}
        breadcrumb={<span>Trace</span>}
        isOpen
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(getEditors()[0].value).toBe('manual input');
      expect(getEditors()[1].value).toBe('manual ground truth');
      expect(getEditors()[2].value).toBe('manual trajectory');
    });
  });

  it('resets user edit guards after closing so the next open can seed fresh values', async () => {
    const { rerender } = renderDialog();
    const [inputEditor, groundTruthEditor, trajectoryEditor] = getEditors();

    fireEvent.change(inputEditor, { target: { value: 'manual input' } });
    fireEvent.change(groundTruthEditor, { target: { value: 'manual ground truth' } });
    fireEvent.change(trajectoryEditor, { target: { value: 'manual trajectory' } });

    rerender(
      <SaveAsDatasetItemDialog
        initialInput="{}"
        initialGroundTruth=""
        breadcrumb={<span>Trace</span>}
        isOpen={false}
        onClose={vi.fn()}
      />,
    );

    rerender(
      <SaveAsDatasetItemDialog
        initialInput={'{"next":2}'}
        initialGroundTruth={'{"expected":"next"}'}
        initialTrajectory={'{"steps":["next"]}'}
        breadcrumb={<span>Trace</span>}
        isOpen
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(getEditors()[0].value).toBe('{"next":2}');
      expect(getEditors()[1].value).toBe('{"expected":"next"}');
      expect(getEditors()[2].value).toBe('{"steps":["next"]}');
    });
  });
});
