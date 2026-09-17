import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { WorkflowInputData } from '../workflow-input-data';

vi.mock('@uiw/react-codemirror', () => ({
  default: ({
    value,
    onChange,
    editable,
  }: {
    value: string;
    onChange?: (value: string) => void;
    editable?: boolean;
  }) => (
    <textarea
      aria-label="Code editor"
      value={value}
      onChange={event => onChange?.(event.target.value)}
      readOnly={editable === false}
    />
  ),
}));

afterEach(cleanup);

const schema = z.object({ documents: z.array(z.object({ title: z.string().min(1), text: z.string().min(1) })) });
const original = { documents: [{ title: 'Original', text: 'Original content' }] };

function renderInput(defaultValues: unknown = original) {
  const onSubmit = vi.fn();
  render(
    <WorkflowInputData
      schema={schema}
      defaultValues={defaultValues}
      isSubmitLoading={false}
      submitButtonLabel="Run"
      onSubmit={onSubmit}
    />,
  );
  return onSubmit;
}

function editJson(value: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Code editor' }), { target: { value } });
}

describe('Workflow input views', () => {
  describe('when an item is added in Form', () => {
    it('includes the edited item in JSON and in the submitted input', async () => {
      const onSubmit = renderInput();
      fireEvent.click(screen.getByRole('button', { name: 'Add Documents item' }));
      fireEvent.change(await screen.findByRole('textbox', { name: /^Title/ }), { target: { value: 'Added' } });
      fireEvent.change(screen.getByRole('textbox', { name: /^Text/ }), { target: { value: 'Added content' } });
      fireEvent.click(screen.getByRole('radio', { name: 'JSON' }));
      const expected = { documents: [...original.documents, { title: 'Added', text: 'Added content' }] };
      expect(JSON.parse(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Code editor' }).value)).toEqual(
        expected,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Run' }));
      await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expected));
    });
  });

  describe('when valid JSON changes the array', () => {
    it('shows and submits those same values after returning to Form', async () => {
      const onSubmit = renderInput();
      fireEvent.click(screen.getByRole('radio', { name: 'JSON' }));
      editJson('{"documents":[{"title":"From JSON","text":"JSON content"}]}');
      fireEvent.click(screen.getByRole('radio', { name: 'Form' }));
      expect(await screen.findByRole('button', { name: 'Item 1: From JSON' })).not.toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Run' }));
      await waitFor(() =>
        expect(onSubmit).toHaveBeenCalledWith({ documents: [{ title: 'From JSON', text: 'JSON content' }] }),
      );
    });
  });

  describe('when JSON is incomplete', () => {
    it('retains the exact text and prevents switching to a misleading form', async () => {
      const onSubmit = renderInput();
      fireEvent.click(screen.getByRole('radio', { name: 'JSON' }));
      editJson('{"documents": [');
      fireEvent.click(screen.getByRole('radio', { name: 'Form' }));
      expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Code editor' }).value).toBe('{"documents": [');
      expect(await screen.findByRole('alert')).not.toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Run' }));
      expect(onSubmit).not.toHaveBeenCalled();
      editJson('{"documents":[]}');
      fireEvent.click(screen.getByRole('radio', { name: 'Form' }));
      expect(await screen.findByText('No items added')).not.toBeNull();
    });
  });

  describe('when JSON leaves a required field empty', () => {
    it('returns to Form with that draft so the field can be filled there', async () => {
      renderInput();
      fireEvent.click(screen.getByRole('radio', { name: 'JSON' }));
      editJson('{"documents": [{"title": "Draft", "text": ""}]}');
      fireEvent.click(screen.getByRole('radio', { name: 'Form' }));
      expect(await screen.findByDisplayValue('Draft')).not.toBeNull();
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  describe('when the schema supplies default input', () => {
    it('shows the actual form defaults in JSON before any field is edited', async () => {
      render(
        <WorkflowInputData
          schema={z.object({ message: z.string().default('Schema default') })}
          isSubmitLoading={false}
          submitButtonLabel="Run"
          onSubmit={vi.fn()}
        />,
      );
      await screen.findByDisplayValue('Schema default');
      fireEvent.click(screen.getByRole('radio', { name: 'JSON' }));
      expect(JSON.parse(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Code editor' }).value)).toEqual({
        message: 'Schema default',
      });
    });
  });

  describe('when an item is removed', () => {
    it('submits an explicitly empty array instead of restoring schema defaults', async () => {
      const onSubmit = vi.fn();
      render(
        <WorkflowInputData
          schema={z.object({ documents: schema.shape.documents.default(original.documents) })}
          isSubmitLoading={false}
          submitButtonLabel="Run"
          onSubmit={onSubmit}
        />,
      );
      fireEvent.click(await screen.findByRole('button', { name: 'Remove item 1' }));
      fireEvent.click(screen.getByRole('button', { name: 'Run' }));
      await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ documents: [] }));
    });

    it('keeps the removal through a Form and JSON round trip', async () => {
      const onSubmit = renderInput();
      fireEvent.click(screen.getByRole('button', { name: 'Remove item 1' }));
      fireEvent.click(screen.getByRole('radio', { name: 'JSON' }));
      expect(JSON.parse(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Code editor' }).value)).toEqual({
        documents: [],
      });
      fireEvent.click(screen.getByRole('radio', { name: 'Form' }));
      expect(await screen.findByText('No items added')).not.toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Run' }));
      await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ documents: [] }));
    });
  });
  describe('when a schema allows an empty string', () => {
    it('submits the same empty value from Form and JSON', async () => {
      const onSubmit = vi.fn();
      render(
        <WorkflowInputData
          schema={z.object({ note: z.string().default('Default note') })}
          defaultValues={{ note: '' }}
          isSubmitLoading={false}
          submitButtonLabel="Run"
          onSubmit={onSubmit}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Run' }));
      await waitFor(() => expect(onSubmit).toHaveBeenLastCalledWith({ note: '' }));
      fireEvent.click(screen.getByRole('radio', { name: 'JSON' }));
      expect(JSON.parse(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Code editor' }).value)).toEqual({
        note: '',
      });
      fireEvent.click(screen.getByRole('button', { name: 'Run' }));
      expect(onSubmit).toHaveBeenLastCalledWith({ note: '' });
    });
  });

  describe('when a required text field is left blank', () => {
    it('blocks the Form view with Required while JSON still submits an explicit empty string', async () => {
      const onSubmit = vi.fn();
      render(
        <WorkflowInputData
          schema={z.object({ query: z.string() })}
          isSubmitLoading={false}
          submitButtonLabel="Run"
          onSubmit={onSubmit}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Run' }));
      await screen.findByText('Required');
      expect(onSubmit).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('radio', { name: 'JSON' }));
      expect(JSON.parse(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Code editor' }).value)).toEqual({
        query: '',
      });
      fireEvent.click(screen.getByRole('button', { name: 'Run' }));
      expect(onSubmit).toHaveBeenCalledWith({ query: '' });
    });
  });

  describe('when optional fields are left untouched', () => {
    it('submits without the keys the user never filled in', async () => {
      const onSubmit = vi.fn();
      render(
        <WorkflowInputData
          schema={z.object({
            prompt: z.string().min(1),
            retries: z.number().optional(),
            note: z.string().min(1).optional(),
            scheduledFor: z.date().optional(),
          })}
          isSubmitLoading={false}
          submitButtonLabel="Run"
          onSubmit={onSubmit}
        />,
      );
      fireEvent.change(await screen.findByRole('textbox', { name: /^Prompt/ }), { target: { value: 'Ship it' } });
      fireEvent.click(screen.getByRole('button', { name: 'Run' }));
      await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ prompt: 'Ship it' }));
    });
  });

  describe('when an edited form is collapsed and reopened', () => {
    it('submits the edited draft instead of restoring the initial input', async () => {
      const onSubmit = vi.fn();
      render(
        <WorkflowInputData
          schema={z.object({ message: z.string() })}
          defaultValues={{ message: 'Original' }}
          isSubmitLoading={false}
          submitButtonLabel="Run"
          onSubmit={onSubmit}
        />,
      );
      fireEvent.change(screen.getByRole('textbox', { name: /^Message/ }), { target: { value: 'Edited' } });
      fireEvent.click(screen.getByRole('button', { name: 'Trigger a run' }));
      await waitFor(() => expect(screen.queryByRole('textbox', { name: /^Message/ })).toBeNull());
      fireEvent.click(screen.getByRole('button', { name: 'Trigger a run' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Run' }));
      await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ message: 'Edited' }));
    });
  });

  describe('when JSON has the wrong root shape for the form', () => {
    it('keeps that draft editable instead of silently replacing it with defaults', () => {
      renderInput();
      fireEvent.click(screen.getByRole('radio', { name: 'JSON' }));
      editJson('null');
      fireEvent.click(screen.getByRole('radio', { name: 'Form' }));
      expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Code editor' }).value).toBe('null');
      expect(screen.getByRole('alert').textContent).toContain('requires a JSON object');
      editJson('{"documents":[]}');
      fireEvent.click(screen.getByRole('radio', { name: 'Form' }));
      expect(screen.getByText('No items added')).not.toBeNull();
    });
  });

  describe('when a root array is edited as JSON', () => {
    it('requires an array before opening Form and submits an empty array without replacing it', async () => {
      const onSubmit = vi.fn();
      render(
        <WorkflowInputData
          schema={z.array(z.string())}
          defaultValues={['Original']}
          isSubmitLoading={false}
          submitButtonLabel="Run"
          onSubmit={onSubmit}
        />,
      );
      fireEvent.click(screen.getByRole('radio', { name: 'JSON' }));
      editJson('null');
      fireEvent.click(screen.getByRole('radio', { name: 'Form' }));
      expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Code editor' }).value).toBe('null');
      editJson('[]');
      fireEvent.click(screen.getByRole('radio', { name: 'Form' }));
      fireEvent.click(screen.getByRole('button', { name: 'Run' }));
      await waitFor(() => expect(onSubmit).toHaveBeenCalledWith([]));
    });
  });

  describe('when a stored run input is read-only', () => {
    it('keeps both form and JSON inspection read-only without a submit action', () => {
      render(
        <WorkflowInputData
          schema={schema}
          defaultValues={original}
          isSubmitLoading={false}
          submitButtonLabel="Run"
          onSubmit={vi.fn()}
          isReadOnly
          withoutSubmit
        />,
      );
      expect(screen.queryByRole('button', { name: 'Add Documents item' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Remove item 1' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Run' })).toBeNull();

      fireEvent.click(screen.getByRole('radio', { name: 'JSON' }));
      const editor = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Code editor' });
      expect(editor.readOnly).toBe(true);
      expect(JSON.parse(editor.value)).toEqual(original);
      expect(screen.queryByRole('button', { name: 'Run' })).toBeNull();

      fireEvent.click(screen.getByRole('radio', { name: 'Form' }));
      fireEvent.click(screen.getByRole('button', { name: 'Item 1: Original' }));
      expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: /^Title/ }).readOnly).toBe(true);
    });
  });

  describe('when execution is disabled', () => {
    it('cannot submit from Simple, Form, or JSON', () => {
      const onSubmit = vi.fn();
      render(
        <WorkflowInputData
          schema={z.object({
            phase: z.string(),
            messages: z.array(z.object({ role: z.string() }).passthrough()),
          })}
          isSubmitLoading={false}
          submitButtonLabel="Run"
          onSubmit={onSubmit}
          isProcessorWorkflow
          disableSubmit
        />,
      );
      for (const view of ['Simple', 'Form', 'JSON']) {
        fireEvent.click(screen.getByRole('radio', { name: view }));
        const submit = screen.getByRole<HTMLButtonElement>('button', { name: 'Run' });
        expect(submit.disabled).toBe(true);
        fireEvent.click(submit);
      }
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
});
