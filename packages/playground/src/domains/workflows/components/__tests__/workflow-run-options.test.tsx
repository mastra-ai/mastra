// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import {
  RequestContextProvider,
  RequestContextSchemaFormRendererProvider,
  useRequestContext,
} from '@mastra/playground-ui/domains/request-context';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { stringify } from 'superjson';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { WorkflowRunOptions } from '../workflow-run-options';
import { TracingSettingsProvider } from '@/domains/observability/context/tracing-settings-context';
import { DynamicForm } from '@/lib/form';
import { RequestContextSchemaFormRenderer } from '@/lib/form/request-context-schema-form-renderer';

const WORKFLOW_ID = 'test';

afterEach(() => cleanup());
beforeEach(() => localStorage.clear());

const requestContextSchema = stringify({
  type: 'object',
  properties: { name: { type: 'string' } },
  required: ['name'],
});

function ContextProbe() {
  const { requestContext } = useRequestContext();
  return <div data-testid="request-context">{JSON.stringify(requestContext)}</div>;
}

/**
 * Mirrors how the popover is mounted in workflow-trigger.tsx: as a React child of the
 * outer workflow DynamicForm (via submitActions), while its content is DOM-portaled.
 */
function renderInsideWorkflowForm(onExecute: (values: unknown) => void, schema?: string) {
  return render(
    <TooltipProvider>
      <TracingSettingsProvider entityId={WORKFLOW_ID} entityType="workflow">
        <RequestContextSchemaFormRendererProvider render={RequestContextSchemaFormRenderer}>
          <RequestContextProvider entityKey={`workflow:${WORKFLOW_ID}`}>
            <DynamicForm
              schema={z.object({ input: z.string().optional() })}
              onSubmit={onExecute}
              submitButtonLabel="Run"
              submitActions={<WorkflowRunOptions requestContextSchema={schema} />}
            />
            <ContextProbe />
          </RequestContextProvider>
        </RequestContextSchemaFormRendererProvider>
      </TracingSettingsProvider>
    </TooltipProvider>,
  );
}

async function openPopover() {
  fireEvent.click(screen.getByTestId('workflow-run-options-trigger'));
  return screen.findByRole('dialog');
}

const requestContextSection = (popover: HTMLElement) =>
  within(popover).getByRole('region', { name: 'Request context' });
const tracingSection = (popover: HTMLElement) =>
  within(popover).getByRole('region', { name: 'Additional run options' });
const saveAllButton = (popover: HTMLElement) =>
  within(popover).getByRole('button', { name: 'Save' }) as HTMLButtonElement;

describe('WorkflowRunOptions', () => {
  describe('when the workflow has a requestContextSchema', () => {
    it('does not submit the surrounding workflow form when saving request context', async () => {
      const onExecute = vi.fn();
      renderInsideWorkflowForm(onExecute, requestContextSchema);

      const popover = await openPopover();
      const section = requestContextSection(popover);
      fireEvent.change(within(section).getByRole('textbox'), { target: { value: 'hello' } });
      await waitFor(() => expect(saveAllButton(popover).disabled).toBe(false));
      fireEvent.click(saveAllButton(popover));

      await waitFor(() => {
        expect(JSON.parse(screen.getByTestId('request-context').textContent ?? '{}')).toMatchObject({ name: 'hello' });
      });
      expect(onExecute).not.toHaveBeenCalled();
    });

    it('saves values into the request context for subsequent runs', async () => {
      const onExecute = vi.fn();
      renderInsideWorkflowForm(onExecute, requestContextSchema);

      const popover = await openPopover();
      const section = requestContextSection(popover);
      fireEvent.change(within(section).getByRole('textbox'), { target: { value: 'world' } });
      await waitFor(() => expect(saveAllButton(popover).disabled).toBe(false));
      fireEvent.click(saveAllButton(popover));

      await waitFor(() => {
        expect(JSON.parse(screen.getByTestId('request-context').textContent ?? '{}')).toMatchObject({ name: 'world' });
      });

      fireEvent.keyDown(popover, { key: 'Escape' });
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

      fireEvent.click(screen.getByRole('button', { name: 'Run' }));

      await waitFor(() => expect(onExecute).toHaveBeenCalledTimes(1));
    });
  });

  describe('when the workflow has no requestContextSchema', () => {
    it('opens the popover with the JSON editor and the tracing editor', async () => {
      renderInsideWorkflowForm(vi.fn());

      const popover = await openPopover();

      expect(await within(popover).findByText('Request Context (JSON)', undefined, { timeout: 10_000 })).not.toBeNull();
      expect(within(popover).queryByRole('button', { name: 'Form' })).toBeNull();
      expect(within(popover).getByText('Tracing Options (JSON)')).not.toBeNull();
    }, 15_000);

    it('stays open when the surrounding workflow form re-renders with a new submitActions element', async () => {
      const view = renderInsideWorkflowForm(vi.fn());
      await openPopover();

      // Mirrors a parent re-render (e.g. useWorkflow refetch): a fresh <WorkflowRunOptions /> element.
      view.rerender(
        <TooltipProvider>
          <TracingSettingsProvider entityId={WORKFLOW_ID} entityType="workflow">
            <RequestContextSchemaFormRendererProvider render={RequestContextSchemaFormRenderer}>
              <RequestContextProvider entityKey={`workflow:${WORKFLOW_ID}`}>
                <DynamicForm
                  schema={z.object({ input: z.string().optional() })}
                  onSubmit={vi.fn()}
                  submitButtonLabel="Run"
                  submitActions={<WorkflowRunOptions requestContextSchema={undefined} />}
                />
                <ContextProbe />
              </RequestContextProvider>
            </RequestContextSchemaFormRendererProvider>
          </TracingSettingsProvider>
        </TooltipProvider>,
      );

      expect(screen.getByRole('dialog')).not.toBeNull();
    });

    it('persists tracing options on Save without running the workflow', async () => {
      const onExecute = vi.fn();
      renderInsideWorkflowForm(onExecute);

      const popover = await openPopover();
      const tracing = tracingSection(popover);
      const saveButton = saveAllButton(popover);

      const editor = tracing.querySelector('.cm-content');
      expect(editor).not.toBeNull();
      fireEvent.input(editor!, { target: { textContent: '{"metadata":{"env":"test"}}' } });

      await waitFor(() => expect(saveButton.disabled).toBe(false));
      fireEvent.click(saveButton);

      await waitFor(() => {
        const stored = JSON.parse(window.localStorage.getItem(`tracing-options-workflow:${WORKFLOW_ID}`) ?? '{}');
        expect(stored.tracingOptions).toEqual({ metadata: { env: 'test' } });
      });
      expect(onExecute).not.toHaveBeenCalled();
    }, 15_000);
  });
});
