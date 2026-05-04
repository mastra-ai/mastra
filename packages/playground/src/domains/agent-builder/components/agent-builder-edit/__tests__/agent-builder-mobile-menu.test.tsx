// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
  onDirtyChange?: (isDirty: boolean) => void;
  children: ReactNode;
}

const FormHarness = ({ defaultVisibility = 'private', onDirtyChange, children }: FormHarnessProps) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: { name: '', instructions: '', visibility: defaultVisibility },
  });
  const value = methods.watch('visibility');
  const isDirty = methods.formState.isDirty;
  onDirtyChange?.(isDirty);
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
  http.get('*/api/channels/platforms', () =>
    HttpResponse.json([{ id: 'slack', name: 'Slack', isConfigured: true }]),
  ),
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

  it('shows visibility item plus a per-platform publish item', async () => {
    server.use(...slackOnlyHandlers());
    render(
      <FormHarness>
        <AgentBuilderMobileMenu agentId="agent-1" showSetVisibility showPublishToChannel />
      </FormHarness>,
    );

    await openDropdown();

    expect(screen.getByTestId('agent-builder-mobile-menu-visibility')).toBeTruthy();
    expect(await screen.findByTestId('agent-builder-mobile-menu-publish-channel-slack')).toBeTruthy();
  });

  it('shows only Publish in view-mode shape and never renders the visibility dialog', async () => {
    server.use(...slackOnlyHandlers());
    render(
      <FormHarness>
        <AgentBuilderMobileMenu agentId="agent-1" showSetVisibility={false} showPublishToChannel />
      </FormHarness>,
    );

    await openDropdown();

    expect(screen.queryByTestId('agent-builder-mobile-menu-visibility')).toBeNull();
    expect(await screen.findByTestId('agent-builder-mobile-menu-publish-channel-slack')).toBeTruthy();
    expect(screen.queryByTestId('agent-builder-visibility-dialog')).toBeNull();
  });

  it('opens the visibility dialog, writes Public into the form (dirties it), and closes on Done', async () => {
    server.use(...slackOnlyHandlers());
    render(
      <FormHarness>
        <AgentBuilderMobileMenu agentId="agent-1" showSetVisibility showPublishToChannel />
      </FormHarness>,
    );

    expect(screen.getByTestId('form-visibility').textContent).toBe('private');
    expect(screen.getByTestId('form-dirty').textContent).toBe('false');

    await openDropdown();
    fireEvent.click(screen.getByTestId('agent-builder-mobile-menu-visibility'));

    const publicOption = await screen.findByTestId('agent-builder-visibility-dialog-option-public');
    fireEvent.click(publicOption);

    expect(screen.getByTestId('form-visibility').textContent).toBe('public');
    expect(screen.getByTestId('form-dirty').textContent).toBe('true');

    fireEvent.click(screen.getByTestId('agent-builder-visibility-dialog-done'));

    expect(screen.queryByTestId('agent-builder-visibility-dialog')).toBeNull();
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
      <FormHarness>
        <AgentBuilderMobileMenu agentId="agent-1" showSetVisibility showPublishToChannel disabled />
      </FormHarness>,
    );

    await openDropdown();

    const visibilityItem = screen.getByTestId('agent-builder-mobile-menu-visibility');
    const publishItem = await screen.findByTestId('agent-builder-mobile-menu-publish-channel-slack');

    expect(visibilityItem.getAttribute('data-disabled')).not.toBeNull();
    expect(publishItem.getAttribute('data-disabled')).not.toBeNull();
  });
});
