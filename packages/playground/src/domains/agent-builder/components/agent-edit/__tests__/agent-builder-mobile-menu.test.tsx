import { TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AgentBuilderEditFormValues } from '../../../schemas';
import { AgentBuilderMobileMenu } from '../agent-builder-mobile-menu';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

interface FormHarnessProps {
  defaultVisibility?: AgentBuilderEditFormValues['visibility'];
  children: ReactNode;
}

const LocationProbe = () => {
  const location = useLocation();
  return <span data-testid="current-location">{location.pathname}</span>;
};

const FormHarness = ({ defaultVisibility = 'private', children }: FormHarnessProps) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: { name: '', instructions: '', visibility: defaultVisibility },
  });
  const value = methods.watch('visibility');
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/start']}>
          <TooltipProvider>
            <FormProvider {...methods}>
              {children}
              <span data-testid="form-visibility">{value}</span>
              <LocationProbe />
            </FormProvider>
          </TooltipProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

const openDropdown = async () => {
  const trigger = await screen.findByTestId('agent-builder-mobile-menu-trigger');
  fireEvent.click(trigger);
  await screen.findByRole('menu');
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

describe('AgentBuilderMobileMenu', () => {
  beforeAll(() => {
    installRadixDomShims();
  });

  beforeEach(() => {
    // The visibility-change flow warms the agent's dependents to decide whether
    // to show impact warnings. Default to an empty list so the dialog renders
    // without unhandled-request noise; individual cases can override.
    server.use(
      http.get(`${BASE_URL}/api/stored/agents/:id/dependents`, () =>
        HttpResponse.json({ dependents: [], hiddenCount: 0 }),
      ),
    );
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing when no items are configured', () => {
    render(
      <FormHarness>
        <AgentBuilderMobileMenu showSetVisibility={false} />
      </FormHarness>,
    );

    expect(screen.queryByTestId('agent-builder-mobile-menu')).toBeNull();
  });

  it('wraps the trigger in an lg:hidden container so desktop never sees it', () => {
    render(
      <FormHarness>
        <AgentBuilderMobileMenu agentId="agent-1" showSetVisibility />
      </FormHarness>,
    );

    const wrapper = screen.getByTestId('agent-builder-mobile-menu');
    expect(wrapper.className).toContain('lg:hidden');
  });

  it('shows Add to library when private', async () => {
    render(
      <FormHarness defaultVisibility="private">
        <AgentBuilderMobileMenu agentId="agent-1" showSetVisibility />
      </FormHarness>,
    );

    await openDropdown();

    expect(screen.getByTestId('agent-builder-mobile-menu-visibility-add')).toBeTruthy();
    expect(screen.queryByTestId('agent-builder-mobile-menu-visibility-remove')).toBeNull();
  });

  it('shows Remove from library when public', async () => {
    render(
      <FormHarness defaultVisibility="public">
        <AgentBuilderMobileMenu agentId="agent-1" showSetVisibility />
      </FormHarness>,
    );

    await openDropdown();

    expect(screen.getByTestId('agent-builder-mobile-menu-visibility-remove')).toBeTruthy();
    expect(screen.queryByTestId('agent-builder-mobile-menu-visibility-add')).toBeNull();
  });

  it('renders nothing when showSetVisibility is false and no other actions are enabled', () => {
    render(
      <FormHarness>
        <AgentBuilderMobileMenu agentId="agent-1" showSetVisibility={false} />
      </FormHarness>,
    );

    expect(screen.queryByTestId('agent-builder-mobile-menu')).toBeNull();
  });

  it('confirming Add to library PATCHes /api/stored/agents/:id with visibility=public', async () => {
    let capturedBody: any = null;
    server.use(
      http.patch(`${BASE_URL}/api/stored/agents/agent-1`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ id: 'agent-1', visibility: 'public' });
      }),
    );
    render(
      <FormHarness defaultVisibility="private">
        <AgentBuilderMobileMenu agentId="agent-1" showSetVisibility />
      </FormHarness>,
    );

    await openDropdown();
    const addItem = screen.getByTestId('agent-builder-mobile-menu-visibility-add');
    await act(async () => {
      fireEvent.pointerDown(addItem, { pointerType: 'mouse', button: 0 });
      fireEvent.pointerUp(addItem, { pointerType: 'mouse', button: 0 });
      fireEvent.click(addItem);
    });

    await act(async () => {
      fireEvent.click(await screen.findByTestId('agent-builder-visibility-confirm-yes'));
    });

    await waitFor(() => {
      expect(capturedBody).toEqual({ visibility: 'public' });
    });
    await waitFor(() => {
      expect(screen.queryByTestId('agent-builder-visibility-confirm-dialog')).toBeNull();
    });
    expect(screen.getByTestId('form-visibility').textContent).toBe('public');
  });

  it('disables menu items when disabled is true', async () => {
    render(
      <FormHarness defaultVisibility="private">
        <AgentBuilderMobileMenu agentId="agent-1" showSetVisibility disabled />
      </FormHarness>,
    );

    await openDropdown();

    const visibilityItem = screen.getByTestId('agent-builder-mobile-menu-visibility-add');
    expect(visibilityItem.getAttribute('data-disabled')).not.toBeNull();
  });

  it('omits the Edit agent item when showEditAgent is false', async () => {
    render(
      <FormHarness>
        <AgentBuilderMobileMenu agentId="agent-1" showSetVisibility />
      </FormHarness>,
    );

    await openDropdown();

    expect(screen.queryByTestId('agent-builder-mobile-menu-edit-agent')).toBeNull();
  });

  it('renders the Edit agent item when showEditAgent is true and navigates to the edit page on click', async () => {
    render(
      <FormHarness>
        <AgentBuilderMobileMenu agentId="agent-1" showEditAgent />
      </FormHarness>,
    );

    await openDropdown();

    const editItem = screen.getByTestId('agent-builder-mobile-menu-edit-agent');
    expect(editItem).toBeTruthy();
    expect(editItem.textContent).toContain('Edit agent');

    await act(async () => {
      fireEvent.click(editItem);
    });

    await waitFor(() => {
      expect(screen.getByTestId('current-location').textContent).toBe('/agent-builder/agents/agent-1/edit');
    });
  });
});
