// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { stringify } from 'superjson';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { WorkflowRequestContextDialog } from '../workflow-request-context-dialog';
import {
  SchemaRequestContextProvider,
  useMergedRequestContext,
} from '@/domains/request-context/context/schema-request-context';
import { DynamicForm } from '@/lib/form';

afterEach(() => cleanup());

const requestContextSchema = stringify({
  type: 'object',
  properties: { name: { type: 'string' } },
  required: ['name'],
});

function MergedContextProbe() {
  const merged = useMergedRequestContext();
  return <div data-testid="merged-context">{JSON.stringify(merged)}</div>;
}

/**
 * Mirrors how the dialog is mounted in workflow-trigger.tsx: as a React child of the
 * outer workflow DynamicForm (via submitActions), while its content is DOM-portaled.
 */
function renderDialogInsideWorkflowForm(onExecute: (values: unknown) => void) {
  return render(
    <SchemaRequestContextProvider>
      <DynamicForm
        schema={z.object({ input: z.string().optional() })}
        onSubmit={onExecute}
        submitButtonLabel="Run"
        submitActions={<WorkflowRequestContextDialog requestContextSchema={requestContextSchema} />}
      />
      <MergedContextProbe />
    </SchemaRequestContextProvider>,
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
    renderDialogInsideWorkflowForm(onExecute);

    await openDialogAndSave('hello');

    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId('merged-context').textContent ?? '{}')).toMatchObject({ name: 'hello' });
    });
    expect(onExecute).not.toHaveBeenCalled();
  });

  it('merges saved values into the request context for subsequent runs', async () => {
    const onExecute = vi.fn();
    renderDialogInsideWorkflowForm(onExecute);

    await openDialogAndSave('world');

    await waitFor(() => {
      expect(JSON.parse(screen.getByTestId('merged-context').textContent ?? '{}')).toMatchObject({ name: 'world' });
    });

    // Close the modal dialog so the outer form becomes accessible again.
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'Run' }));

    await waitFor(() => expect(onExecute).toHaveBeenCalledTimes(1));
  });
});
