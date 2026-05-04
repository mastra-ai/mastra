// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw-server';
import {
  DefaultChannelDialog,
  getPublishChannelDialog,
  SlackChannelDialog,
} from '../publish-channel-dialogs';

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

describe('getPublishChannelDialog', () => {
  it('returns the Slack-specific dialog for "slack"', () => {
    expect(getPublishChannelDialog('slack')).toBe(SlackChannelDialog);
  });

  it('returns the default dialog for unknown platforms', () => {
    expect(getPublishChannelDialog('discord')).toBe(DefaultChannelDialog);
  });
});

describe('DefaultChannelDialog', () => {
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
        <DefaultChannelDialog
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
        <DefaultChannelDialog
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
        <DefaultChannelDialog
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

  it('shows a Disconnect action that asks for confirmation and closes on confirm', async () => {
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
        <DefaultChannelDialog
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
        />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('publish-channel-dialog-discord-disconnect'));

    // The publish dialog closes and the confirm dialog opens — only one
    // dialog is ever visible at a time.
    const confirmButton = await screen.findByTestId('publish-channel-dialog-discord-disconnect-confirm');
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    // The disconnect API itself has not fired until the user confirms.
    expect(disconnectCalled).toBe(false);

    fireEvent.click(confirmButton);
    await waitFor(() => {
      expect(disconnectCalled).toBe(true);
    });
  });

  it('cancels disconnect when the user dismisses the confirmation', async () => {
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
        <DefaultChannelDialog
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
        />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('publish-channel-dialog-discord-disconnect'));

    const cancelButton = await screen.findByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    // Wait for the confirmation dialog to close before asserting nothing fired.
    await waitFor(() => {
      expect(screen.queryByTestId('publish-channel-dialog-discord-disconnect-confirm')).toBeNull();
    });

    // Cancel must not call disconnect. The publish dialog itself does close
    // when the user clicks Disconnect (intentional — see openDisconnectConfirm),
    // so onOpenChange(false) is expected; what matters is the API isn't hit.
    expect(disconnectCalled).toBe(false);
  });

  it('shows a "Not configured" notice and no Connect button when the platform is not configured', () => {
    render(
      <Wrapper>
        <DefaultChannelDialog
          platform={{ id: 'discord', name: 'Discord', isConfigured: false }}
          agentId="agent-1"
          open
          onOpenChange={() => {}}
        />
      </Wrapper>,
    );

    expect(screen.getByTestId('publish-channel-dialog-discord').textContent).toContain('Not configured');
    expect(screen.queryByTestId('publish-channel-dialog-discord-connect')).toBeNull();
  });
});
