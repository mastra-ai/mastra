import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

function editJson(value: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'Code editor' }), { target: { value } });
}

describe('Workflow processor input views', () => {
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

  describe('when processor JSON contains an invalid message shape', () => {
    it('keeps the recoverable JSON draft instead of crashing Simple mode', () => {
      render(
        <WorkflowInputData
          schema={z.object({ phase: z.string(), messages: z.array(z.unknown()) })}
          isSubmitLoading={false}
          submitButtonLabel="Run"
          onSubmit={vi.fn()}
          isProcessorWorkflow
        />,
      );
      fireEvent.click(screen.getByRole('radio', { name: 'JSON' }));
      const invalidDraft = '{"phase":"input","messages":[{"content":{"parts":{}}}]}';
      editJson(invalidDraft);
      fireEvent.click(screen.getByRole('radio', { name: 'Simple' }));
      expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Code editor' }).value).toBe(invalidDraft);
      expect(screen.getByRole('alert').textContent).toContain('Correct the JSON first');
      editJson('{"phase":"input","messages":[]}');
      fireEvent.click(screen.getByRole('radio', { name: 'Simple' }));
      expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Test Message' }).value).toBe('');
    });
  });

  describe('when a processor phase changes', () => {
    it('shares the matching author role with JSON before either view submits', async () => {
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
        />,
      );
      fireEvent.click(screen.getByRole('combobox', { name: 'Phase' }));
      const outputResult = await screen.findByRole('option', { name: 'outputResult' });
      fireEvent.pointerDown(outputResult, { pointerType: 'mouse' });
      fireEvent.click(outputResult, { detail: 1 });
      fireEvent.click(screen.getByRole('radio', { name: 'JSON' }));
      const draft: unknown = JSON.parse(
        screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Code editor' }).value,
      );
      expect(draft).toMatchObject({ phase: 'outputResult', messages: [{ role: 'assistant' }] });
      fireEvent.click(screen.getByRole('button', { name: 'Run' }));
      expect(onSubmit).toHaveBeenCalledWith(draft);
    });
  });

  describe('when a stored processor payload has an invalid message shape', () => {
    it('opens the payload in JSON instead of crashing Simple', () => {
      const stored = { phase: 'input', messages: [{ content: { parts: {} } }] };
      render(
        <WorkflowInputData
          schema={z.object({ phase: z.string(), messages: z.array(z.unknown()) })}
          defaultValues={stored}
          isSubmitLoading={false}
          submitButtonLabel="Run"
          onSubmit={vi.fn()}
          isProcessorWorkflow
        />,
      );
      expect(JSON.parse(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Code editor' }).value)).toEqual(
        stored,
      );
      fireEvent.click(screen.getByRole('radio', { name: 'Simple' }));
      expect(screen.getByRole('alert').textContent).toContain('Correct the JSON first');
    });
  });
});
