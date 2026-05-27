// @vitest-environment jsdom
import type * as PlaygroundUi from '@mastra/playground-ui';
import { TooltipProvider } from '@mastra/playground-ui';
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

vi.mock('@mastra/playground-ui', async () => {
  const actual = await vi.importActual<typeof PlaygroundUi>('@mastra/playground-ui');
  return {
    ...actual,
    toast: {
      success: (...args: unknown[]) => toastSuccessMock(...args),
      error: (...args: unknown[]) => toastErrorMock(...args),
    },
  };
});

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

describe('ChannelDialog (default platform)', () => {
  beforeAll(() => {
    installRadixDomShims();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('handles oauth result by redirecting to authorizationUrl', async () => {
    server.use(
      http.post('*/api/channels/discord/connect', () =>
        HttpResponse.json({
          type: 'oauth',
          authorizationUrl: 'https://oauth.example.com/authorize?id=abc',
          installationId: 'inst-1',
        }),
      ),
    );

    // Stub window.location.href assignment.
    const originalHref = window.location.href;
    const hrefSetter = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new Proxy(window.location, {
        set(_target, prop, value) {
          if (prop === 'href') {
            hrefSetter(value);
            return true;
          }
          return true;
        },
        get(target, prop) {
          // @ts-expect-error indexed access
          return target[prop];
        },
      }),
    });

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
    await waitFor(() => {
      expect(hrefSetter).toHaveBeenCalledWith('https://oauth.example.com/authorize?id=abc');
    });

    // Restore so other tests are unaffected.
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: originalHref },
    });
  });

  it('handles deep_link result by calling window.open and surfacing a popup-blocked toast', async () => {
    server.use(
      http.post('*/api/channels/discord/connect', () =>
        HttpResponse.json({
          type: 'deep_link',
          url: 'tg://example',
          installationId: 'inst-2',
        }),
      ),
    );

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
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
      expect(openSpy).toHaveBeenCalledWith('tg://example', '_blank', 'noopener,noreferrer');
    });
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('handles immediate result by closing the dialog', async () => {
    server.use(
      http.post('*/api/channels/discord/connect', () =>
        HttpResponse.json({ type: 'immediate', installationId: 'inst-3' }),
      ),
    );

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
