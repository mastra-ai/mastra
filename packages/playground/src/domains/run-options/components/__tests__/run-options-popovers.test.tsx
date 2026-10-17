import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { toast } from '@mastra/playground-ui/utils/toast';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { stringify } from 'superjson';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { RequestContextPopover } from '../request-context-popover';
import { WorkflowRunActions } from '../workflow-run-actions';

vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'agent-1';
const WORKFLOW_ID = 'wf-1';

beforeAll(() => {
  if (typeof window.PointerEvent === 'undefined') {
    window.PointerEvent = window.MouseEvent as unknown as typeof PointerEvent;
  }
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.localStorage.clear();
  delete (window as typeof window & { MASTRA_REQUEST_CONTEXT_PRESETS?: string }).MASTRA_REQUEST_CONTEXT_PRESETS;
});

const renderWithProviders = (ui: React.ReactNode, entityType: 'agent' | 'workflow', entityId: string) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TooltipProvider>{ui}</TooltipProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

const open = async (name: string) => {
  await act(async () => {
    fireEvent.click(await screen.findByRole('button', { name }));
  });
};

describe('RequestContextPopover', () => {
  describe('when the user saves a preset from the JSON editor', () => {
    it('persists it for the entity, toasts and closes', async () => {
      (window as typeof window & { MASTRA_REQUEST_CONTEXT_PRESETS?: string }).MASTRA_REQUEST_CONTEXT_PRESETS =
        JSON.stringify({ French: { locale: 'fr' } });
      renderWithProviders(<RequestContextPopover entityType="agent" entityId={AGENT_ID} />, 'agent', AGENT_ID);

      await open('Request context');
      expect(
        await screen.findByRole('textbox', { name: 'Request Context (JSON)' }, { timeout: 10_000 }),
      ).not.toBeNull();

      fireEvent.click(screen.getByRole('combobox', { name: 'Request Context preset' }));
      const presetOption = await screen.findByRole('option', { name: 'French' });
      fireEvent.pointerDown(presetOption, { pointerType: 'mouse' });
      fireEvent.click(presetOption, { detail: 1 });
      const saveButton = screen.getByRole<HTMLButtonElement>('button', { name: 'Save' });
      await waitFor(() => expect(saveButton.disabled).toBe(false));
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(window.localStorage.getItem(`mastra-request-context:agent:${AGENT_ID}`)).toBe('{"locale":"fr"}');
      });
      expect(toast.success).toHaveBeenCalledWith('Request context saved locally');
      await waitFor(() => expect(screen.queryByText('Request Context (JSON)')).toBeNull());
    }, 15_000);
  });
});

function WorkflowTriggerHarness({ onSubmit }: { onSubmit: () => void }) {
  const [resourceId, setResourceId] = useState('');
  return (
    <form
      onSubmit={event => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <WorkflowRunActions workflowId={WORKFLOW_ID} resourceId={resourceId} setResourceId={setResourceId} />
      <output data-testid="resource-id">{resourceId}</output>
    </form>
  );
}

describe('WorkflowRunActions', () => {
  describe('when the workflow has no request context schema', () => {
    it('still exposes the request context popover', async () => {
      renderWithProviders(<WorkflowTriggerHarness onSubmit={vi.fn()} />, 'workflow', WORKFLOW_ID);

      expect(await screen.findByRole('button', { name: 'Request context' })).not.toBeNull();
    });
  });

  describe('when the user saves tracing options with a resource ID', () => {
    it('commits the draft, toasts, closes and does not submit the workflow form', async () => {
      const onSubmit = vi.fn();
      renderWithProviders(<WorkflowTriggerHarness onSubmit={onSubmit} />, 'workflow', WORKFLOW_ID);

      await open('Tracing options');
      fireEvent.change(await screen.findByLabelText('Resource ID'), { target: { value: 'tenant-42' } });
      expect(screen.getByTestId('resource-id').textContent).toBe('');

      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(screen.getByTestId('resource-id').textContent).toBe('tenant-42'));
      expect(toast.success).toHaveBeenCalledWith('Tracing options saved locally');
      await waitFor(() => expect(screen.queryByLabelText('Resource ID')).toBeNull());
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
});
