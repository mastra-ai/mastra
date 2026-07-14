import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
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
  describe('when the form view renders a string field', () => {
    it('uses a multiline text input', async () => {
      render(
        <WorkflowInputData
          schema={z.object({ prompt: z.string() })}
          defaultValues={{ prompt: 'First line\nSecond line' }}
          isSubmitLoading={false}
          submitButtonLabel="Run"
          onSubmit={() => {}}
        />,
      );

      const promptInput = await screen.findByRole<HTMLTextAreaElement>('textbox', { name: /prompt/i });

      expect(promptInput.tagName).toBe('TEXTAREA');
    });

    it('starts at one line', async () => {
      render(
        <WorkflowInputData
          schema={z.object({ prompt: z.string() })}
          isSubmitLoading={false}
          submitButtonLabel="Run"
          onSubmit={() => {}}
        />,
      );

      const promptInput = await screen.findByRole<HTMLTextAreaElement>('textbox', { name: /prompt/i });

      expect(promptInput.rows).toBe(1);
    });
  });

  it('renders processor default values in the simple read-only input', async () => {
    render(
      <WorkflowInputData
        schema={processorSchema}
        defaultValues={{
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
        }}
        isSubmitLoading={false}
        submitButtonLabel="Run"
        onSubmit={() => {}}
        withoutSubmit
        isReadOnly
        isProcessorWorkflow
      />,
    );

    const messageInput = await screen.findByDisplayValue('Stored processor run input');
    expect(messageInput).toHaveProperty('disabled', true);
    await waitFor(() => expect(screen.getByText('outputResult')).not.toBeNull());
  });

  it('keeps processor fallback values for new simple inputs', async () => {
    render(
      <WorkflowInputData
        schema={processorSchema}
        isSubmitLoading={false}
        submitButtonLabel="Run"
        onSubmit={() => {}}
        isProcessorWorkflow
      />,
    );

    const messageInput = await screen.findByDisplayValue('Hello, this is a test message.');
    expect(messageInput).toHaveProperty('disabled', false);
    await waitFor(() => expect(screen.getByText('input')).not.toBeNull());
  });
});
