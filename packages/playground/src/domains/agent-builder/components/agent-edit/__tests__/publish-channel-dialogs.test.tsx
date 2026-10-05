import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ChannelDialog } from '../publish-channel-dialogs';
import { server } from '@/test/msw-server';

const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

const BASE_URL = 'http://localhost:4111';

const Wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
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

describe('ChannelDialog (default platform)', () => {
  beforeAll(() => {
    installRadixDomShims();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('handles oauth result by opening the authorization URL in a new tab and closing the dialog', async () => {
    server.use(
      http.post('*/api/channels/discord/connect', () =>
        HttpResponse.json({
          type: 'oauth',
          authorizationUrl: 'https://oauth.example.com/authorize?id=abc',
          installationId: 'inst-1',
        }),
      ),
    );

    // New tab (not a same-tab redirect) keeps this studio tab alive so the
    // installations query refetches on focus-return after the OAuth flow.
    const tab = stubOpenTab();
    const onOpenChange = vi.fn();

    render(
      <Wrapper>
        <ChannelDialog
          platform={{ id: 'discord', name: 'Discord', isConfigured: true }}
          agentId="agent-1"
          open
          onOpenChange={onOpenChange}
        />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('publish-channel-dialog-discord-connect'));
    // The tab opens synchronously on click (while user activation is live),
    // then navigates once the connect request resolves.
    expect(window.open).toHaveBeenCalledWith('about:blank', '_blank');
    await waitFor(() => {
      expect(tab.location.href).toBe('https://oauth.example.com/authorize?id=abc');
    });
    expect(tab.opener).toBeNull();
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it('falls back to navigating this tab when the popup blocker eats every window.open', async () => {
    server.use(
      http.post('*/api/channels/discord/connect', () =>
        HttpResponse.json({
          type: 'oauth',
          authorizationUrl: 'https://oauth.example.com/authorize?id=abc',
          installationId: 'inst-1',
        }),
      ),
    );

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
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

    try {
      render(
        <Wrapper>
          <ChannelDialog
            platform={{ id: 'discord', name: 'Discord', isConfigured: true }}
            agentId="agent-1"
            open
            onOpenChange={() => {}}
          />
        </Wrapper>,
      );

      fireEvent.click(screen.getByTestId('publish-channel-dialog-discord-connect'));
      // Pre-open on click is blocked, the fresh attempt on resolve is blocked —
      // the connect POST already created the pending install, so the flow must
      // not dead-end: it navigates the current tab instead of toasting.
      await waitFor(() => {
        expect(hrefSetter).toHaveBeenCalledWith('https://oauth.example.com/authorize?id=abc');
      });
      expect(openSpy).toHaveBeenCalledTimes(2);
      expect(toastErrorMock).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    }
  });

  it('handles deep_link result by navigating the pre-opened tab to the deep link', async () => {
    server.use(
      http.post('*/api/channels/discord/connect', () =>
        HttpResponse.json({
          type: 'deep_link',
          url: 'tg://example',
          installationId: 'inst-2',
        }),
      ),
    );

    const tab = stubOpenTab();
    const onOpenChange = vi.fn();

    render(
      <Wrapper>
        <ChannelDialog
          platform={{ id: 'discord', name: 'Discord', isConfigured: true }}
          agentId="agent-1"
          open
          onOpenChange={onOpenChange}
        />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('publish-channel-dialog-discord-connect'));
    expect(window.open).toHaveBeenCalledWith('about:blank', '_blank');
    await waitFor(() => {
      expect(tab.location.href).toBe('tg://example');
    });
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('handles immediate result by closing the dialog and the unused pre-opened tab', async () => {
    server.use(
      http.post('*/api/channels/discord/connect', () =>
        HttpResponse.json({ type: 'immediate', installationId: 'inst-3' }),
      ),
    );

    const tab = stubOpenTab();
    const onOpenChange = vi.fn();
    render(
      <Wrapper>
        <ChannelDialog
          platform={{ id: 'discord', name: 'Discord', isConfigured: true }}
          agentId="agent-1"
          open
          onOpenChange={onOpenChange}
        />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('publish-channel-dialog-discord-connect'));
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(tab.close).toHaveBeenCalled();
    expect(tab.location.href).toBe('about:blank'); // never navigated
  });

  it('switches to the disconnect-confirm view in-place when the Disconnect action is clicked', () => {
    render(
      <Wrapper>
        <ChannelDialog
          platform={{ id: 'discord', name: 'Discord', isConfigured: true }}
          agentId="agent-1"
          installation={{
            id: 'inst-9',
            platform: 'discord',
            agentId: 'agent-1',
            status: 'active',
            displayName: 'My Discord',
          }}
          open
          onOpenChange={() => {}}
        />
      </Wrapper>,
    );

    // Publish view shows Disconnect.
    fireEvent.click(screen.getByTestId('publish-channel-dialog-discord-disconnect'));

    // Same dialog node, swapped content — confirms the view changed without remounting the overlay.
    const dialog = screen.getByTestId('publish-channel-dialog-discord');
    expect(dialog.textContent).toContain('Are you sure?');
    expect(dialog.textContent).toContain('Your agent will be removed from Discord');
    expect(screen.getByTestId('publish-channel-dialog-discord-disconnect-confirm')).toBeTruthy();
  });

  it('shows a "Not configured" notice and no Connect button when the platform is not configured', () => {
    render(
      <Wrapper>
        <ChannelDialog
          platform={{ id: 'discord', name: 'Discord', isConfigured: false }}
          agentId="agent-1"
          open
          onOpenChange={() => {}}
        />
      </Wrapper>,
    );

    expect(screen.getByTestId('publish-channel-dialog-discord').textContent).toContain(
      'This platform is not configured on the server.',
    );
    expect(screen.queryByTestId('publish-channel-dialog-discord-connect')).toBeNull();
  });
});

describe('ChannelDialog (slack platform)', () => {
  beforeAll(() => {
    installRadixDomShims();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('treats a pending installation as not connected and shows the Continue with Slack action', () => {
    render(
      <Wrapper>
        <ChannelDialog
          platform={{ id: 'slack', name: 'Slack', isConfigured: true }}
          agentId="agent-1"
          installation={{
            id: 'inst-pending',
            platform: 'slack',
            agentId: 'agent-1',
            status: 'pending',
          }}
          open
          onOpenChange={() => {}}
        />
      </Wrapper>,
    );

    const dialog = screen.getByTestId('publish-channel-dialog-slack');
    expect(dialog.textContent).toContain('You will be redirected to Slack');
    expect(dialog.textContent).not.toContain('Connected to');

    expect(screen.getByTestId('publish-channel-dialog-slack-connect')).toBeTruthy();
    expect(screen.queryByTestId('publish-channel-dialog-slack-disconnect')).toBeNull();
  });
});

describe('ChannelDialog (disconnect view)', () => {
  beforeAll(() => {
    installRadixDomShims();
  });

  afterEach(() => {
    cleanup();
    toastSuccessMock.mockClear();
    toastErrorMock.mockClear();
  });

  it('fires the disconnect API, toasts success, and closes on confirm', async () => {
    let disconnectCalled = false;
    server.use(
      http.post('*/api/channels/discord/:agentId/disconnect', () => {
        disconnectCalled = true;
        return HttpResponse.json({ success: true });
      }),
    );

    const onOpenChange = vi.fn();
    render(
      <Wrapper>
        <ChannelDialog
          platform={{ id: 'discord', name: 'Discord', isConfigured: true }}
          agentId="agent-1"
          installation={{
            id: 'inst-9',
            platform: 'discord',
            agentId: 'agent-1',
            status: 'active',
            displayName: 'My Discord',
          }}
          open
          onOpenChange={onOpenChange}
          initialView="confirm-disconnect"
        />
      </Wrapper>,
    );

    const confirmButton = screen.getByTestId('publish-channel-dialog-discord-disconnect-confirm');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(disconnectCalled).toBe(true);
    });
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(toastSuccessMock).toHaveBeenCalledWith('Discord disconnected');
  });

  it('shows a generic confirm title and a single platform-name mention in the body', () => {
    render(
      <Wrapper>
        <ChannelDialog
          platform={{ id: 'slack', name: 'Slack', isConfigured: true }}
          agentId="agent-1"
          installation={{
            id: 'inst-1',
            platform: 'slack',
            agentId: 'agent-1',
            status: 'active',
            displayName: 'Acme Workspace',
          }}
          open
          onOpenChange={() => {}}
          initialView="confirm-disconnect"
        />
      </Wrapper>,
    );

    const dialog = screen.getByTestId('publish-channel-dialog-slack');
    expect(dialog.textContent).toContain('Are you sure?');
    expect(dialog.textContent).toContain('Your agent will be removed from Slack');
    // No card, so the workspace display name is not rendered.
    expect(dialog.textContent).not.toContain('Acme Workspace');
    // Platform name appears exactly once (in the body sentence).
    const slackMatches = dialog.textContent?.match(/Slack/g) ?? [];
    expect(slackMatches.length).toBe(1);
    // Confirm/Cancel labels.
    expect(screen.getByRole('button', { name: /confirm/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeTruthy();
  });

  it('returns to the publish view (without closing) when canceled', async () => {
    let disconnectCalled = false;
    server.use(
      http.post('*/api/channels/discord/:agentId/disconnect', () => {
        disconnectCalled = true;
        return HttpResponse.json({ success: true });
      }),
    );

    const onOpenChange = vi.fn();
    render(
      <Wrapper>
        <ChannelDialog
          platform={{ id: 'discord', name: 'Discord', isConfigured: true }}
          agentId="agent-1"
          installation={{
            id: 'inst-9',
            platform: 'discord',
            agentId: 'agent-1',
            status: 'active',
            displayName: 'My Discord',
          }}
          open
          onOpenChange={onOpenChange}
          initialView="confirm-disconnect"
        />
      </Wrapper>,
    );

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    // Same dialog, swapped back to publish view; dialog stays open.
    const dialog = screen.getByTestId('publish-channel-dialog-discord');
    expect(dialog.textContent).not.toContain('Are you sure?');
    expect(screen.getByTestId('publish-channel-dialog-discord-disconnect')).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(disconnectCalled).toBe(false);
  });
});
