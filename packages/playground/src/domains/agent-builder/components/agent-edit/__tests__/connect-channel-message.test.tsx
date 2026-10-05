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

/**
 * jsdom throws on real navigation; intercept `window.location.href = …` with a
 * spy. Slack's connect flow redirects back to Studio, so the action navigates
 * the CURRENT tab instead of pre-opening a new one.
 */
const stubLocationHref = () => {
  const originalLocation = window.location;
  const hrefSetter = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: new Proxy(originalLocation, {
      set(_target, prop, value) {
        if (prop === 'href') hrefSetter(value);
        return true;
      },
      get(target, prop) {
        // @ts-expect-error indexed access
        return target[prop];
      },
    }),
  });
  const restore = () => Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  return { hrefSetter, restore };
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

  it('shows "Continue with Slack" and navigates this tab to the OAuth URL when configured but not yet connected', async () => {
    let connectCalled = false;
    const openSpy = vi.spyOn(window, 'open');
    const { hrefSetter, restore } = stubLocationHref();

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

    try {
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
      // Slack's flow redirects back to Studio, so the CURRENT tab navigates —
      // no pre-opened tab that would leave this Studio copy stale.
      await waitFor(() => {
        expect(hrefSetter).toHaveBeenCalledWith('https://slack.example/oauth');
      });
      expect(openSpy).not.toHaveBeenCalled();
    } finally {
      restore();
    }
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

  it('leaves this tab alone when the connect mutation settles with an error', async () => {
    const openSpy = vi.spyOn(window, 'open');
    const { hrefSetter, restore } = stubLocationHref();

    server.use(
      platformsHandler([{ id: 'slack', name: 'Slack', isConfigured: true }]),
      installationsHandler({}),
      http.post('*/api/channels/slack/connect', () => HttpResponse.json({ error: 'nope' }, { status: 500 })),
    );

    try {
      render(
        <Wrapper>
          <ConnectChannelMessage platformId="slack" agentId="agent-1" />
        </Wrapper>,
      );

      const button = await screen.findByTestId('agent-builder-chat-connect-channel-slack-button');
      fireEvent.click(button);

      // The button label flips back once the mutation settles — the error path
      // must never navigate away from Studio or open a tab.
      await waitFor(() => expect(button.textContent).toBe('Continue with Slack'));
      expect(hrefSetter).not.toHaveBeenCalled();
      expect(openSpy).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it('navigates this tab even when the surface unmounts before connect resolves', async () => {
    const { hrefSetter, restore } = stubLocationHref();
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

    try {
      const { unmount } = render(
        <Wrapper>
          <ConnectChannelMessage platformId="slack" agentId="agent-1" />
        </Wrapper>,
      );

      const button = await screen.findByTestId('agent-builder-chat-connect-channel-slack-button');
      fireEvent.click(button);

      // The surface goes away while the request is in flight (e.g. the user
      // closes the dialog). React Query's per-call mutate callbacks are skipped
      // after unmount — the flow must still navigate, not silently dead-end
      // with a pending install already created server-side.
      unmount();
      releaseConnect();

      await waitFor(() => {
        expect(hrefSetter).toHaveBeenCalledWith('https://slack.example/oauth');
      });
    } finally {
      restore();
    }
  });
});
