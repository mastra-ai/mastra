import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
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
    Object.defineProperty(globalThis, 'ResizeObserver', { configurable: true, value: StubResizeObserver });
  }
};

type TabStub = { opener: Window | null; location: { href: string }; close: ReturnType<typeof vi.fn> };

/**
 * jsdom has no window.open; stub it with a navigable tab handle shaped like the
 * one the connect action pre-opens on click and navigates once the request resolves.
 */
const stubOpenTab = (): TabStub => {
  const tab: TabStub = { opener: window, location: { href: 'about:blank' }, close: vi.fn() };
  vi.spyOn(window, 'open').mockImplementation(() => tab as unknown as Window);
  return tab;
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
    vi.restoreAllMocks();
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

  it('renders nothing after the platform query resolves without a matching platform', async () => {
    server.use(platformsHandler([]), installationsHandler({}));

    const { container } = render(
      <Wrapper>
        <ConnectChannelMessage platformId="slack" agentId="agent-1" />
      </Wrapper>,
    );

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
    expect(button).toHaveProperty('disabled', true);
    const badge = screen.getAllByText('Not configured').find(element => element.tagName === 'SPAN');
    expect(badge).toBeDefined();
    expect(badge?.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('shows "Continue with Slack" and opens the OAuth URL in a new tab when configured but not yet connected', async () => {
    let connectCalled = false;
    const tab = stubOpenTab();

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

    // The tab opens synchronously on click (while user activation is live),
    // then navigates once the connect request resolves.
    expect(window.open).toHaveBeenCalledWith('about:blank', '_blank');
    await waitFor(() => {
      expect(connectCalled).toBe(true);
    });
    await waitFor(() => {
      expect(tab.location.href).toBe('https://slack.example/oauth');
    });
    expect(tab.opener).toBeNull();
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
    expect((await screen.findByText('Connected')).querySelector('[aria-hidden="true"]')).not.toBeNull();

    const button = await screen.findByTestId('agent-builder-chat-connect-channel-slack-button');
    expect(button.textContent).toContain('Manage');
  });

  it('closes the pre-opened tab without navigating it when the connect mutation settles with an error', async () => {
    const tab = stubOpenTab();

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

    // The error path closes the tab — waiting on it (not the label, which starts
    // as "Continue with Slack") guarantees the mutation actually settled.
    await waitFor(() => expect(tab.close).toHaveBeenCalled());
    expect(tab.location.href).toBe('about:blank'); // never navigated
    await waitFor(() => expect(button.textContent).toBe('Continue with Slack'));
  });

  it('navigates the pre-opened tab even when the surface unmounts before connect resolves', async () => {
    const tab = stubOpenTab();
    let releaseConnect!: () => void;
    const gate = new Promise<void>(resolve => {
      releaseConnect = resolve;
    });

    server.use(
      platformsHandler([{ id: 'slack', name: 'Slack', isConfigured: true }]),
      installationsHandler({}),
      http.post('*/api/channels/slack/connect', async () => {
        await gate;
        return HttpResponse.json({
          type: 'oauth',
          authorizationUrl: 'https://slack.example/oauth',
          installationId: 'inst-1',
        });
      }),
    );

    const { unmount } = render(
      <Wrapper>
        <ConnectChannelMessage platformId="slack" agentId="agent-1" />
      </Wrapper>,
    );

    const button = await screen.findByTestId('agent-builder-chat-connect-channel-slack-button');
    fireEvent.click(button);
    expect(window.open).toHaveBeenCalledWith('about:blank', '_blank');

    // The surface goes away while the request is in flight (e.g. the user
    // closes the dialog). React Query's per-call mutate callbacks are skipped
    // after unmount — the tab must still be navigated, not stranded on
    // about:blank with authorization never starting.
    unmount();
    releaseConnect();

    await waitFor(() => {
      expect(tab.location.href).toBe('https://slack.example/oauth');
    });
    expect(tab.close).not.toHaveBeenCalled();
  });
});
