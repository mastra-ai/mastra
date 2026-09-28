// @vitest-environment jsdom
import '@/test/jsdom-polyfills';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { stringify } from 'superjson';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { WorkflowRunProvider } from '../../context/workflow-run-provider';
import { WorkflowRequestContextDialog } from '../workflow-request-context-dialog';
import { DynamicForm } from '@/lib/form';
import { renderWithProviders } from '@/test/render';

afterEach(() => cleanup());

const requestContextSchema = stringify({
  type: 'object',
  properties: { name: { type: 'string' } },
  required: ['name'],
});

/**
 * Mirrors how the dialog is mounted in workflow-trigger.tsx: as a React child of the
 * outer workflow DynamicForm (via submitActions), while its content is DOM-portaled.
 */
function renderDialogInsideWorkflowForm(
  onExecute: (values: unknown) => void,
  onRequestContextChange: (values: Record<string, unknown>) => void,
) {
  return renderWithProviders(
    <WorkflowRunProvider workflowId="">
      <DynamicForm
        schema={z.object({ input: z.string().optional() })}
        onSubmit={onExecute}
        submitButtonLabel="Run"
        submitActions={
          <WorkflowRequestContextDialog
            requestContextSchema={requestContextSchema}
            requestContext={{}}
            onRequestContextChange={onRequestContextChange}
          />
        }
      />
    </WorkflowRunProvider>,
  );
}

async function openDialogAndSave(name: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Request Context' }));

  const dialog = await screen.findByRole('dialog');
  const input = within(dialog).getByRole('textbox');
  fireEvent.change(input, { target: { value: name } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

  return dialog;
}

describe('WorkflowRequestContextDialog', () => {
  it('does not submit the surrounding workflow form when saving request context', async () => {
    const onExecute = vi.fn();
    const onRequestContextChange = vi.fn();
    renderDialogInsideWorkflowForm(onExecute, onRequestContextChange);

    await openDialogAndSave('hello');

    await waitFor(() => expect(onRequestContextChange).toHaveBeenCalledWith({ name: 'hello' }));
    expect(onExecute).not.toHaveBeenCalled();
  });

  it('reports saved values and keeps the workflow form runnable', async () => {
    const onExecute = vi.fn();
    const onRequestContextChange = vi.fn();
    renderDialogInsideWorkflowForm(onExecute, onRequestContextChange);

    await openDialogAndSave('world');

    await waitFor(() => expect(onRequestContextChange).toHaveBeenCalledWith({ name: 'world' }));

    // Close the modal dialog so the outer form becomes accessible again.
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'Run' }));

    await waitFor(() => expect(onExecute).toHaveBeenCalledTimes(1));
  });
});
