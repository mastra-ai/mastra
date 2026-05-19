// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ConnectChannelMessage } from '../connect-channel-message';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const Wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>{children}</TooltipProvider>
      </QueryClientProvider>
    </MastraReactProvider>
  );
};

const installRadixDomShims = () => {
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
  if (typeof globalThis.ResizeObserver === 'undefined') {
    class StubResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (globalThis as unknown as { ResizeObserver: typeof StubResizeObserver }).ResizeObserver = StubResizeObserver;
  }
};

const platformsHandler = (platforms: unknown[]) =>
  http.get('*/api/channels/platforms', () => HttpResponse.json(platforms));

const installationsHandler = (perPlatform: Record<string, unknown[]>) =>
  http.get('*/api/channels/:platform/installations', ({ params }) => {
    const platform = String(params.platform);
    return HttpResponse.json(perPlatform[platform] ?? []);
  });

describe('ConnectChannelMessage', () => {
  beforeAll(() => {
    installRadixDomShims();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing when agentId is missing', () => {
    server.use(platformsHandler([{ id: 'slack', name: 'Slack', isConfigured: true }]), installationsHandler({}));

    const { container } = render(
      <Wrapper>
        <ConnectChannelMessage platformId="slack" agentId={undefined} />
      </Wrapper>,
    );

    expect(container.querySelector('[data-testid="agent-builder-chat-connect-channel-slack"]')).toBeNull();
  });

  it('renders nothing when the platform is not in the platforms list', async () => {
    server.use(platformsHandler([]), installationsHandler({}));

    const { container } = render(
      <Wrapper>
        <ConnectChannelMessage platformId="slack" agentId="agent-1" />
      </Wrapper>,
    );

    // Let the platforms query resolve
    await new Promise(r => setTimeout(r, 0));
    expect(container.querySelector('[data-testid="agent-builder-chat-connect-channel-slack"]')).toBeNull();
  });

  it('shows a disabled "Not configured" button when the platform is not configured', async () => {
    server.use(platformsHandler([{ id: 'slack', name: 'Slack', isConfigured: false }]), installationsHandler({}));

    render(
      <Wrapper>
        <ConnectChannelMessage platformId="slack" agentId="agent-1" />
      </Wrapper>,
    );

    const button = await screen.findByTestId('agent-builder-chat-connect-channel-slack-button');
    expect(button.textContent).toContain('Not configured');
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows "Continue with Slack" and triggers the OAuth redirect when configured but not yet connected', async () => {
    let connectCalled = false;
    const originalLocation = window.location;
    const locationStub = { href: 'http://localhost/start' };
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: locationStub,
    });

    server.use(
      platformsHandler([{ id: 'slack', name: 'Slack', isConfigured: true }]),
      installationsHandler({}),
      http.post('*/api/channels/slack/connect', () => {
        connectCalled = true;
        return HttpResponse.json({
          type: 'oauth',
          authorizationUrl: 'https://slack.example/oauth',
          installationId: 'inst-1',
        });
      }),
    );

    render(
      <Wrapper>
        <ConnectChannelMessage platformId="slack" agentId="agent-1" />
      </Wrapper>,
    );

    const button = await screen.findByTestId('agent-builder-chat-connect-channel-slack-button');
    expect(button.textContent).toContain('Continue with Slack');

    fireEvent.click(button);

    await waitFor(() => {
      expect(connectCalled).toBe(true);
    });
    await waitFor(() => {
      expect(locationStub.href).toBe('https://slack.example/oauth');
    });

    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
  });

  it('shows a "Connected" badge and a Manage button when there is an active installation', async () => {
    server.use(
      platformsHandler([{ id: 'slack', name: 'Slack', isConfigured: true }]),
      installationsHandler({
        slack: [
          {
            id: 'inst-1',
            platform: 'slack',
            agentId: 'agent-1',
            status: 'active',
            displayName: 'Acme Corp',
          },
        ],
      }),
    );

    render(
      <Wrapper>
        <ConnectChannelMessage platformId="slack" agentId="agent-1" />
      </Wrapper>,
    );

    const widget = await screen.findByTestId('agent-builder-chat-connect-channel-slack');
    expect(widget.textContent).toContain('Connected');

    const button = await screen.findByTestId('agent-builder-chat-connect-channel-slack-button');
    expect(button.textContent).toContain('Manage');
  });

  it('does not navigate when the connect mutation errors', async () => {
    const originalLocation = window.location;
    const locationStub = { href: 'http://localhost/start' };
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: locationStub,
    });

    server.use(
      platformsHandler([{ id: 'slack', name: 'Slack', isConfigured: true }]),
      installationsHandler({}),
      http.post('*/api/channels/slack/connect', () => HttpResponse.json({ error: 'nope' }, { status: 500 })),
    );

    render(
      <Wrapper>
        <ConnectChannelMessage platformId="slack" agentId="agent-1" />
      </Wrapper>,
    );

    const button = await screen.findByTestId('agent-builder-chat-connect-channel-slack-button');
    fireEvent.click(button);

    // Give the failed mutation a chance to resolve
    await new Promise(r => setTimeout(r, 50));
    expect(locationStub.href).toBe('http://localhost/start');

    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
  });
});
