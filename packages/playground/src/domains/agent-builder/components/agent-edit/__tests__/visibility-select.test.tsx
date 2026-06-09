// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import type { AgentBuilderEditFormValues } from '../../../schemas';
import { VisibilitySelect } from '../visibility-select';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'agent-1';

interface FormHarnessProps {
  defaultVisibility?: AgentBuilderEditFormValues['visibility'];
  children: ReactNode;
}

const FormHarness = ({ defaultVisibility = 'private', children }: FormHarnessProps) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: { name: '', instructions: '', visibility: defaultVisibility },
  });
  const value = methods.watch('visibility');
  const isDirty = methods.formState.isDirty;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TooltipProvider>
            <FormProvider {...methods}>
              {children}
              <span data-testid="form-visibility">{value}</span>
              <span data-testid="form-dirty">{isDirty ? 'true' : 'false'}</span>
            </FormProvider>
          </TooltipProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

describe('VisibilitySelect', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the Add to library button when the saved value is private', () => {
    render(
      <FormHarness>
        <VisibilitySelect agentId={AGENT_ID} />
      </FormHarness>,
    );

    expect(screen.getByTestId('agent-builder-visibility-add')).toBeTruthy();
    expect(screen.queryByTestId('agent-builder-visibility-remove')).toBeNull();
  });

  it('renders the Remove from library button when the saved value is public', () => {
    render(
      <FormHarness defaultVisibility="public">
        <VisibilitySelect agentId={AGENT_ID} />
      </FormHarness>,
    );

    expect(screen.getByTestId('agent-builder-visibility-remove')).toBeTruthy();
    expect(screen.queryByTestId('agent-builder-visibility-add')).toBeNull();
  });

  it('opens the confirm dialog with add-to-library copy when Add is clicked, without issuing a request', async () => {
    let patchCalled = false;
    server.use(
      http.patch(`${BASE_URL}/api/stored/agents/${AGENT_ID}`, () => {
        patchCalled = true;
        return HttpResponse.json({ id: AGENT_ID, visibility: 'public' });
      }),
    );

    render(
      <FormHarness>
        <VisibilitySelect agentId={AGENT_ID} />
      </FormHarness>,
    );

    fireEvent.click(screen.getByTestId('agent-builder-visibility-add'));

    const dialog = await screen.findByTestId('agent-builder-visibility-confirm-dialog');
    expect(dialog.textContent).toContain('Add this agent to your library?');
    expect(dialog.textContent).toContain('teammates will be able to discover');
    expect(patchCalled).toBe(false);
    expect(screen.getByTestId('form-visibility').textContent).toBe('private');
  });

  it('cancel leaves the saved value, leaves the form clean, and issues no request', async () => {
    let patchCalled = false;
    server.use(
      http.patch(`${BASE_URL}/api/stored/agents/${AGENT_ID}`, () => {
        patchCalled = true;
        return HttpResponse.json({ id: AGENT_ID, visibility: 'public' });
      }),
    );

    render(
      <FormHarness>
        <VisibilitySelect agentId={AGENT_ID} />
      </FormHarness>,
    );

    fireEvent.click(screen.getByTestId('agent-builder-visibility-add'));
    fireEvent.click(await screen.findByTestId('agent-builder-visibility-confirm-cancel'));

    await waitFor(() => {
      expect(screen.queryByTestId('agent-builder-visibility-confirm-dialog')).toBeNull();
    });

    expect(patchCalled).toBe(false);
    expect(screen.getByTestId('agent-builder-visibility-add')).toBeTruthy();
    expect(screen.getByTestId('form-visibility').textContent).toBe('private');
    expect(screen.getByTestId('form-dirty').textContent).toBe('false');
  });

  it('confirm issues PATCH with the new visibility, swaps the button to Remove, and keeps the form clean', async () => {
    let capturedBody: any = null;
    server.use(
      http.patch(`${BASE_URL}/api/stored/agents/${AGENT_ID}`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ id: AGENT_ID, visibility: 'public' });
      }),
    );

    render(
      <FormHarness>
        <VisibilitySelect agentId={AGENT_ID} />
      </FormHarness>,
    );

    fireEvent.click(screen.getByTestId('agent-builder-visibility-add'));
    await act(async () => {
      fireEvent.click(await screen.findByTestId('agent-builder-visibility-confirm-yes'));
    });

    await waitFor(() => {
      expect(capturedBody).toEqual({ visibility: 'public' });
    });
    await waitFor(() => {
      expect(screen.queryByTestId('agent-builder-visibility-confirm-dialog')).toBeNull();
    });
    expect(screen.getByTestId('agent-builder-visibility-remove')).toBeTruthy();
    expect(screen.getByTestId('form-visibility').textContent).toBe('public');
    expect(screen.getByTestId('form-dirty').textContent).toBe('false');
  });

  it('shows the remove-from-library copy when starting from public and clicking Remove', async () => {
    server.use(
      http.patch(`${BASE_URL}/api/stored/agents/${AGENT_ID}`, () =>
        HttpResponse.json({ id: AGENT_ID, visibility: 'private' }),
      ),
    );

    render(
      <FormHarness defaultVisibility="public">
        <VisibilitySelect agentId={AGENT_ID} />
      </FormHarness>,
    );

    fireEvent.click(screen.getByTestId('agent-builder-visibility-remove'));

    const dialog = await screen.findByTestId('agent-builder-visibility-confirm-dialog');
    expect(dialog.textContent).toContain('Remove this agent from your library?');
    expect(dialog.textContent).toContain('teammates will no longer be able to');
    expect(dialog.textContent).toContain('only person with access');
  });

  it('reverts to the saved value when the PATCH fails', async () => {
    server.use(
      http.patch(`${BASE_URL}/api/stored/agents/${AGENT_ID}`, () =>
        HttpResponse.json({ error: 'boom' }, { status: 500 }),
      ),
    );

    render(
      <FormHarness>
        <VisibilitySelect agentId={AGENT_ID} />
      </FormHarness>,
    );

    fireEvent.click(screen.getByTestId('agent-builder-visibility-add'));
    await act(async () => {
      fireEvent.click(await screen.findByTestId('agent-builder-visibility-confirm-yes'));
    });

    await waitFor(() => {
      expect(screen.queryByTestId('agent-builder-visibility-confirm-dialog')).toBeNull();
    });
    expect(screen.getByTestId('agent-builder-visibility-add')).toBeTruthy();
    expect(screen.getByTestId('form-visibility').textContent).toBe('private');
    expect(screen.getByTestId('form-dirty').textContent).toBe('false');
  });
});
