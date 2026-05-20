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
import { AgentBuilderMobileMenu } from '../agent-builder-mobile-menu';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

interface FormHarnessProps {
  defaultVisibility?: AgentBuilderEditFormValues['visibility'];
  children: ReactNode;
}

const FormHarness = ({ defaultVisibility = 'private', children }: FormHarnessProps) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: { name: '', instructions: '', visibility: defaultVisibility },
  });
  const value = methods.watch('visibility');
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TooltipProvider>
            <FormProvider {...methods}>
              {children}
              <span data-testid="form-visibility">{value}</span>
            </FormProvider>
          </TooltipProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

const openDropdown = async () => {
  const trigger = await screen.findByTestId('agent-builder-mobile-menu-trigger');
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'Enter' });
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

const slackOnlyHandlers = () => [
  http.get('*/api/channels/platforms', () => HttpResponse.json([{ id: 'slack', name: 'Slack', isConfigured: true }])),
  http.get('*/api/channels/:platform/installations', () => HttpResponse.json([])),
];

describe('AgentBuilderMobileMenu', () => {
  beforeAll(() => {
    installRadixDomShims();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing when no items are configured', () => {
    server.use(...slackOnlyHandlers());
    render(
      <FormHarness>
        <AgentBuilderMobileMenu showSetVisibility={false} showPublishToChannel={false} />
      </FormHarness>,
    );

    expect(screen.queryByTestId('agent-builder-mobile-menu')).toBeNull();
  });

  it('wraps the trigger in an lg:hidden container so desktop never sees it', () => {
    server.use(...slackOnlyHandlers());
    render(
      <FormHarness>
        <AgentBuilderMobileMenu agentId="agent-1" showSetVisibility showPublishToChannel />
      </FormHarness>,
    );

    const wrapper = screen.getByTestId('agent-builder-mobile-menu');
    expect(wrapper.className).toContain('lg:hidden');
  });

  it('shows Add to library when private and Publish item per platform', async () => {
    server.use(...slackOnlyHandlers());
    render(
      <FormHarness defaultVisibility="private">
        <AgentBuilderMobileMenu agentId="agent-1" showSetVisibility showPublishToChannel />
      </FormHarness>,
    );

    await openDropdown();

    expect(screen.getByTestId('agent-builder-mobile-menu-visibility-add')).toBeTruthy();
    expect(screen.queryByTestId('agent-builder-mobile-menu-visibility-remove')).toBeNull();
    expect(await screen.findByTestId('agent-builder-mobile-menu-publish-channel-slack')).toBeTruthy();
  });

  it('shows Remove from library when public', async () => {
    server.use(...slackOnlyHandlers());
    render(
      <FormHarness defaultVisibility="public">
        <AgentBuilderMobileMenu agentId="agent-1" showSetVisibility showPublishToChannel />
      </FormHarness>,
    );

    await openDropdown();

    expect(screen.getByTestId('agent-builder-mobile-menu-visibility-remove')).toBeTruthy();
    expect(screen.queryByTestId('agent-builder-mobile-menu-visibility-add')).toBeNull();
  });

  it('hides visibility items when showSetVisibility is false', async () => {
    server.use(...slackOnlyHandlers());
    render(
      <FormHarness>
        <AgentBuilderMobileMenu agentId="agent-1" showSetVisibility={false} showPublishToChannel />
      </FormHarness>,
    );

    await openDropdown();

    expect(screen.queryByTestId('agent-builder-mobile-menu-visibility-add')).toBeNull();
    expect(screen.queryByTestId('agent-builder-mobile-menu-visibility-remove')).toBeNull();
    expect(await screen.findByTestId('agent-builder-mobile-menu-publish-channel-slack')).toBeTruthy();
  });

  it('confirming Add to library PATCHes /api/stored/agents/:id with visibility=public', async () => {
    let capturedBody: any = null;
    server.use(
      ...slackOnlyHandlers(),
      http.patch(`${BASE_URL}/api/stored/agents/agent-1`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ id: 'agent-1', visibility: 'public' });
      }),
    );
    render(
      <FormHarness defaultVisibility="private">
        <AgentBuilderMobileMenu agentId="agent-1" showSetVisibility showPublishToChannel />
      </FormHarness>,
    );

    await openDropdown();
    fireEvent.click(screen.getByTestId('agent-builder-mobile-menu-visibility-add'));

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

  it('triggers the Slack connect endpoint directly (skipping the dialog) when not yet connected', async () => {
    let connectCalled = false;
    server.use(
      http.get('*/api/channels/platforms', () =>
        HttpResponse.json([{ id: 'slack', name: 'Slack', isConfigured: true }]),
      ),
      http.get('*/api/channels/:platform/installations', () => HttpResponse.json([])),
      http.post('*/api/channels/slack/connect', () => {
        connectCalled = true;
        return HttpResponse.json({ type: 'oauth', authorizationUrl: 'https://slack.example/oauth' });
      }),
    );
    render(
      <FormHarness>
        <AgentBuilderMobileMenu agentId="agent-1" showSetVisibility={false} showPublishToChannel />
      </FormHarness>,
    );

    await openDropdown();
    const slackItem = await screen.findByTestId('agent-builder-mobile-menu-publish-channel-slack');
    fireEvent.click(slackItem);

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(connectCalled).toBe(true);
    expect(screen.queryByTestId('publish-channel-dialog-slack')).toBeNull();
  });

  it('opens the publish dialog when an unconfigured platform is selected', async () => {
    server.use(
      http.get('*/api/channels/platforms', () =>
        HttpResponse.json([{ id: 'slack', name: 'Slack', isConfigured: false }]),
      ),
      http.get('*/api/channels/:platform/installations', () => HttpResponse.json([])),
    );
    render(
      <FormHarness>
        <AgentBuilderMobileMenu agentId="agent-1" showSetVisibility={false} showPublishToChannel />
      </FormHarness>,
    );

    await openDropdown();
    const slackItem = await screen.findByTestId('agent-builder-mobile-menu-publish-channel-slack');
    fireEvent.click(slackItem);

    const dialog = await screen.findByTestId('publish-channel-dialog-slack');
    expect(dialog.textContent).toContain('Slack');
  });

  it('disables menu items when disabled is true', async () => {
    server.use(...slackOnlyHandlers());
    render(
      <FormHarness defaultVisibility="private">
        <AgentBuilderMobileMenu agentId="agent-1" showSetVisibility showPublishToChannel disabled />
      </FormHarness>,
    );

    await openDropdown();

    const visibilityItem = screen.getByTestId('agent-builder-mobile-menu-visibility-add');
    const publishItem = await screen.findByTestId('agent-builder-mobile-menu-publish-channel-slack');

    expect(visibilityItem.getAttribute('data-disabled')).not.toBeNull();
    expect(publishItem.getAttribute('data-disabled')).not.toBeNull();
  });
});
