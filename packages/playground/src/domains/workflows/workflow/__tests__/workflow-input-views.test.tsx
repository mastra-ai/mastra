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
      renderInput();
      fireEvent.click(screen.getByRole('button', { name: 'Remove item 1' }));
      fireEvent.click(screen.getByRole('radio', { name: 'JSON' }));
      expect(JSON.parse(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Code editor' }).value)).toEqual({
        documents: [],
      });
      fireEvent.click(screen.getByRole('radio', { name: 'Form' }));
      expect(await screen.findByText('No items added')).not.toBeNull();
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

  describe('when a processor message is edited', () => {
    it('shares Simple and JSON edits without replacing other messages or metadata', () => {
      const message = {
        id: 'message-1',
        role: 'user',
        createdAt: '2026-09-15T00:00:00.000Z',
        content: { format: 2, parts: [{ type: 'text', text: 'Original message' }] },
      };
      const input = { phase: 'input', messages: [message, { ...message, id: 'message-2' }], requestId: 'keep-request' };
      const processorSchema = z.object({
        phase: z.string(),
        messages: z.array(
          z.object({
            id: z.string(),
            role: z.string(),
            createdAt: z.string(),
            content: z.object({ format: z.number(), parts: z.array(z.object({ type: z.string(), text: z.string() })) }),
          }),
        ),
        requestId: z.string(),
      });
      const onSubmit = vi.fn();
      render(
        <WorkflowInputData
          schema={processorSchema}
          defaultValues={input}
          isSubmitLoading={false}
          submitButtonLabel="Run"
          onSubmit={onSubmit}
          isProcessorWorkflow
        />,
      );
      fireEvent.change(screen.getByRole('textbox', { name: 'Test Message' }), { target: { value: 'Simple edit' } });
      fireEvent.click(screen.getByRole('radio', { name: 'JSON' }));
      const expected = {
        ...input,
        messages: [
          { ...message, content: { ...message.content, parts: [{ type: 'text', text: 'Simple edit' }] } },
          input.messages[1],
        ],
      };
      expect(JSON.parse(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Code editor' }).value)).toEqual(
        expected,
      );
      const fromJson = {
        ...expected,
        messages: [
          { ...expected.messages[0], content: { format: 2, parts: [{ type: 'text', text: 'JSON edit' }] } },
          input.messages[1],
        ],
      };
      editJson(JSON.stringify(fromJson));
      fireEvent.click(screen.getByRole('radio', { name: 'Simple' }));
      expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Test Message' }).value).toBe('JSON edit');
      fireEvent.click(screen.getByRole('button', { name: 'Run' }));
      expect(onSubmit).toHaveBeenCalledWith(fromJson);
    });
  });
  describe('when a new processor run has no stored payload', () => {
    it('initializes one message shared by Simple and JSON', () => {
      render(
        <WorkflowInputData
          schema={z.object({ phase: z.string(), messages: z.array(z.unknown()) })}
          defaultValues={null}
          isSubmitLoading={false}
          submitButtonLabel="Run"
          onSubmit={vi.fn()}
          isProcessorWorkflow
        />,
      );
      expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Test Message' }).value).toBe(
        'Hello, this is a test message.',
      );
      fireEvent.click(screen.getByRole('radio', { name: 'JSON' }));
      const firstJson = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Code editor' }).value;
      fireEvent.click(screen.getByRole('radio', { name: 'Simple' }));
      fireEvent.click(screen.getByRole('radio', { name: 'JSON' }));
      expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Code editor' }).value).toBe(firstJson);
    });
  });
});
