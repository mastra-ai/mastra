// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
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

const installRadixDomShims = () => {
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (typeof globalThis.ResizeObserver === 'undefined') {
    class StubResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (globalThis as unknown as { ResizeObserver: typeof StubResizeObserver }).ResizeObserver = StubResizeObserver;
  }
};

const openTrigger = async () => {
  const trigger = await screen.findByTestId('agent-builder-visibility-trigger');
  fireEvent.click(trigger);
  fireEvent.keyDown(trigger, { key: 'Enter' });
  return trigger;
};

const selectOption = async (optionName: 'Public' | 'Private') => {
  await openTrigger();
  const option = await screen.findByRole('option', { name: optionName });
  fireEvent.click(option);
};

describe('VisibilitySelect', () => {
  beforeAll(() => {
    installRadixDomShims();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the saved value as Private and is not disabled', () => {
    render(
      <FormHarness>
        <VisibilitySelect agentId={AGENT_ID} />
      </FormHarness>,
    );

    const trigger = screen.getByTestId('agent-builder-visibility-trigger');
    expect(trigger.textContent).toContain('Private');
    expect(trigger.hasAttribute('disabled')).toBe(false);
    expect(trigger.getAttribute('data-disabled')).toBeNull();
  });

  it('opens the confirm dialog with public copy when Public is picked, without issuing a request', async () => {
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

    await selectOption('Public');

    const dialog = await screen.findByTestId('agent-builder-visibility-confirm-dialog');
    expect(dialog.textContent).toContain('Make this agent public?');
    expect(dialog.textContent).toContain('added to your organization library');
    expect(dialog.textContent).toContain('Anyone in your organization');
    expect(patchCalled).toBe(false);
    expect(screen.getByTestId('form-visibility').textContent).toBe('private');
  });

  it('cancel restores the saved value, leaves the form clean, and issues no request', async () => {
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

    await selectOption('Public');
    fireEvent.click(await screen.findByTestId('agent-builder-visibility-confirm-cancel'));

    await waitFor(() => {
      expect(screen.queryByTestId('agent-builder-visibility-confirm-dialog')).toBeNull();
    });

    expect(patchCalled).toBe(false);
    expect(screen.getByTestId('agent-builder-visibility-trigger').textContent).toContain('Private');
    expect(screen.getByTestId('form-visibility').textContent).toBe('private');
    expect(screen.getByTestId('form-dirty').textContent).toBe('false');
  });

  it('confirm issues PATCH with the new visibility, updates the trigger, and keeps the form clean', async () => {
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

    await selectOption('Public');
    await act(async () => {
      fireEvent.click(await screen.findByTestId('agent-builder-visibility-confirm-yes'));
    });

    await waitFor(() => {
      expect(capturedBody).toEqual({ visibility: 'public' });
    });
    await waitFor(() => {
      expect(screen.queryByTestId('agent-builder-visibility-confirm-dialog')).toBeNull();
    });
    expect(screen.getByTestId('agent-builder-visibility-trigger').textContent).toContain('Public');
    expect(screen.getByTestId('form-visibility').textContent).toBe('public');
    expect(screen.getByTestId('form-dirty').textContent).toBe('false');
  });

  it('shows the private copy when starting from public and selecting Private', async () => {
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

    await selectOption('Private');

    const dialog = await screen.findByTestId('agent-builder-visibility-confirm-dialog');
    expect(dialog.textContent).toContain('Make this agent private?');
    expect(dialog.textContent).toContain('removed from your organization library');
    expect(dialog.textContent).toContain('only person');
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

    await selectOption('Public');
    await act(async () => {
      fireEvent.click(await screen.findByTestId('agent-builder-visibility-confirm-yes'));
    });

    await waitFor(() => {
      expect(screen.queryByTestId('agent-builder-visibility-confirm-dialog')).toBeNull();
    });
    expect(screen.getByTestId('agent-builder-visibility-trigger').textContent).toContain('Private');
    expect(screen.getByTestId('form-visibility').textContent).toBe('private');
    expect(screen.getByTestId('form-dirty').textContent).toBe('false');
  });
});
