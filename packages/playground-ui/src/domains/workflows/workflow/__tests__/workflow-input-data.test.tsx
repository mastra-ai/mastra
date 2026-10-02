// @vitest-environment jsdom
import '@/test/jsdom-polyfills';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { WorkflowInputData } from '../workflow-input-data';

const processorSchema = z.object({
  messages: z.array(
    z.object({
      id: z.string(),
      role: z.string(),
      createdAt: z.string(),
      content: z.object({
        format: z.number(),
        parts: z.array(z.object({ type: z.string(), text: z.string() })),
      }),
    }),
  ),
  phase: z.string(),
});

afterEach(() => cleanup());

describe('WorkflowInputData', () => {
  describe('when the form view renders an array of objects', () => {
    it('submits an added object item after its required field is edited', async () => {
      const onSubmit = vi.fn();

      render(
        <WorkflowInputData
          schema={z.object({ input: z.array(z.object({ email: z.string() })) })}
          isSubmitLoading={false}
          submitButtonLabel="Run"
          onSubmit={onSubmit}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Add Input item' }));
      fireEvent.change(await screen.findByRole('textbox', { name: /email/i }), {
        target: { value: 'ada@example.com' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Run' }));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({ input: [{ email: 'ada@example.com' }] });
      });
    });
  });

  describe('when a string input contains multiple lines', () => {
    it('preserves the line breaks in the submitted workflow input', async () => {
      const onSubmit = vi.fn();
      render(
        <WorkflowInputData
          schema={z.object({ prompt: z.string() })}
          isSubmitLoading={false}
          submitButtonLabel="Run"
          onSubmit={onSubmit}
        />,
      );

      fireEvent.change(await screen.findByRole('textbox', { name: /prompt/i }), {
        target: { value: 'First line\nSecond line' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Run' }));

      await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ prompt: 'First line\nSecond line' }));
    });
  });

  describe('when a stored processor input is edited', () => {
    it('submits the new message while preserving its identity and phase', () => {
      const onSubmit = vi.fn();
      const input = {
        messages: [
          {
            id: 'message-1',
            role: 'assistant',
            createdAt: '2026-06-08T00:00:00.000Z',
            content: {
              format: 2,
              parts: [{ type: 'text', text: 'Stored processor run input' }],
            },
          },
        ],
        phase: 'outputResult',
      };
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

      fireEvent.change(screen.getByRole('textbox', { name: 'Test Message' }), {
        target: { value: 'Edited processor input' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Run' }));
      expect(onSubmit).toHaveBeenCalledWith({
        ...input,
        messages: [
          {
            ...input.messages[0],
            content: { format: 2, parts: [{ type: 'text', text: 'Edited processor input' }] },
          },
        ],
      });
    });
  });

  describe('when a stored processor input is edited', () => {
    it('submits the new message while preserving its identity and phase', () => {
      const onSubmit = vi.fn();
      const input = {
        messages: [
          {
            id: 'message-1',
            role: 'assistant',
            createdAt: '2026-06-08T00:00:00.000Z',
            content: {
              format: 2,
              parts: [{ type: 'text', text: 'Stored processor run input' }],
            },
          },
        ],
        phase: 'outputResult',
      };
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

      fireEvent.change(screen.getByRole('textbox', { name: 'Test Message' }), {
        target: { value: 'Edited processor input' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Run' }));
      expect(onSubmit).toHaveBeenCalledWith({
        ...input,
        messages: [
          {
            ...input.messages[0],
            content: { format: 2, parts: [{ type: 'text', text: 'Edited processor input' }] },
          },
        ],
      });
    });
  });
});
