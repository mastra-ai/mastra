// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PublishToChannelButton } from '../publish-to-channel-button';
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

const openDropdown = async () => {
  const trigger = screen.getByTestId('agent-builder-publish-channel');
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'Enter' });
  await screen.findByRole('menu');
};

const platformsHandler = (platforms: unknown[]) =>
  http.get('*/api/channels/platforms', () => HttpResponse.json(platforms));

const installationsHandler = (perPlatform: Record<string, unknown[]>) =>
  http.get('*/api/channels/:platform/installations', ({ params }) => {
    const platform = String(params.platform);
    return HttpResponse.json(perPlatform[platform] ?? []);
  });

describe('PublishToChannelButton', () => {
  beforeAll(() => {
    installRadixDomShims();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing when there are no platforms', async () => {
    server.use(platformsHandler([]), installationsHandler({}));
    const { container } = render(
      <Wrapper>
        <PublishToChannelButton agentId="agent-1" />
      </Wrapper>,
    );

    // Wait one microtask so the query resolves
    await new Promise(r => setTimeout(r, 0));
    expect(container.querySelector('[data-testid="agent-builder-publish-channel"]')).toBeNull();
  });

  it('renders nothing when agentId is missing', () => {
    server.use(
      platformsHandler([{ id: 'slack', name: 'Slack', isConfigured: true }]),
      installationsHandler({}),
    );
    render(
      <Wrapper>
        <PublishToChannelButton agentId={undefined} />
      </Wrapper>,
    );

    expect(screen.queryByTestId('agent-builder-publish-channel')).toBeNull();
  });

  it('shows the "Publish to…" trigger and lists platforms with status badges', async () => {
    server.use(
      platformsHandler([
        { id: 'slack', name: 'Slack', isConfigured: true },
        { id: 'discord', name: 'Discord', isConfigured: false },
      ]),
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
        <PublishToChannelButton agentId="agent-1" />
      </Wrapper>,
    );

    const trigger = await screen.findByTestId('agent-builder-publish-channel');
    expect(trigger.textContent).toContain('Publish to');

    await openDropdown();

    const slackItem = await screen.findByTestId('agent-builder-publish-channel-item-slack');
    const discordItem = await screen.findByTestId('agent-builder-publish-channel-item-discord');

    expect(slackItem.textContent).toContain('Slack');
    expect(slackItem.textContent).toContain('Connected');
    expect(discordItem.textContent).toContain('Discord');
    expect(discordItem.textContent).toContain('Not configured');
  });

  it('triggers the Slack connect endpoint directly (skipping the dialog) when not yet connected', async () => {
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
        return HttpResponse.json({ type: 'oauth', authorizationUrl: 'https://slack.example/oauth' });
      }),
    );

    render(
      <Wrapper>
        <PublishToChannelButton agentId="agent-1" />
      </Wrapper>,
    );

    await screen.findByTestId('agent-builder-publish-channel');
    await openDropdown();

    const slackItem = await screen.findByTestId('agent-builder-publish-channel-item-slack');
    fireEvent.click(slackItem);

    await waitFor(() => {
      expect(connectCalled).toBe(true);
    });
    await waitFor(() => {
      expect(locationStub.href).toBe('https://slack.example/oauth');
    });
    // The dialog must not appear — the direct connect flow replaces it.
    expect(screen.queryByTestId('publish-channel-dialog-slack')).toBeNull();

    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
  });

  it('treats a pending-only Slack installation as not connected and re-triggers the connect flow', async () => {
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
      installationsHandler({
        slack: [
          {
            id: 'inst-pending',
            platform: 'slack',
            agentId: 'agent-1',
            status: 'pending',
          },
        ],
      }),
      http.post('*/api/channels/slack/connect', () => {
        connectCalled = true;
        return HttpResponse.json({ type: 'oauth', authorizationUrl: 'https://slack.example/oauth' });
      }),
    );

    render(
      <Wrapper>
        <PublishToChannelButton agentId="agent-1" />
      </Wrapper>,
    );

    await screen.findByTestId('agent-builder-publish-channel');
    await openDropdown();

    const slackItem = await screen.findByTestId('agent-builder-publish-channel-item-slack');
    expect(slackItem.textContent).not.toContain('Connected');

    fireEvent.click(slackItem);

    await waitFor(() => {
      expect(connectCalled).toBe(true);
    });
    await waitFor(() => {
      expect(locationStub.href).toBe('https://slack.example/oauth');
    });
    // The dialog must not appear — pending installations re-enter the direct connect flow.
    expect(screen.queryByTestId('publish-channel-dialog-slack')).toBeNull();

    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
  });

  it('opens the Slack dialog (and does not auto-connect) when the channel is already connected', async () => {
    let connectCalled = false;
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
      http.post('*/api/channels/slack/connect', () => {
        connectCalled = true;
        return HttpResponse.json({ type: 'oauth', authorizationUrl: 'https://slack.example/oauth' });
      }),
    );

    render(
      <Wrapper>
        <PublishToChannelButton agentId="agent-1" />
      </Wrapper>,
    );

    await screen.findByTestId('agent-builder-publish-channel');
    await openDropdown();

    const slackItem = await screen.findByTestId('agent-builder-publish-channel-item-slack');
    fireEvent.click(slackItem);

    const dialog = await screen.findByTestId('publish-channel-dialog-slack');
    expect(dialog.textContent).toContain('Connected Slack to Mastra');
    expect(screen.getByTestId('publish-channel-dialog-slack-disconnect')).toBeTruthy();
    expect(connectCalled).toBe(false);
  });

  it('opens the Slack dialog (and does not auto-connect) when the platform is not configured', async () => {
    let connectCalled = false;
    server.use(
      platformsHandler([{ id: 'slack', name: 'Slack', isConfigured: false }]),
      installationsHandler({}),
      http.post('*/api/channels/slack/connect', () => {
        connectCalled = true;
        return HttpResponse.json({ type: 'oauth', authorizationUrl: 'https://slack.example/oauth' });
      }),
    );

    render(
      <Wrapper>
        <PublishToChannelButton agentId="agent-1" />
      </Wrapper>,
    );

    await screen.findByTestId('agent-builder-publish-channel');
    await openDropdown();

    const slackItem = await screen.findByTestId('agent-builder-publish-channel-item-slack');
    fireEvent.click(slackItem);

    const dialog = await screen.findByTestId('publish-channel-dialog-slack');
    expect(dialog.textContent).toContain('Slack is not configured on the server.');
    expect(connectCalled).toBe(false);
  });

  it('opens the default dialog for an unconfigured platform with the "Not configured" notice', async () => {
    server.use(
      platformsHandler([{ id: 'discord', name: 'Discord', isConfigured: false }]),
      installationsHandler({}),
    );

    render(
      <Wrapper>
        <PublishToChannelButton agentId="agent-1" />
      </Wrapper>,
    );

    await screen.findByTestId('agent-builder-publish-channel');
    await openDropdown();

    const discordItem = await screen.findByTestId('agent-builder-publish-channel-item-discord');
    fireEvent.click(discordItem);

    const dialog = await screen.findByTestId('publish-channel-dialog-discord');
    expect(dialog.textContent).toContain('This platform is not configured on the server.');
    // No Connect button rendered when platform is not configured.
    expect(screen.queryByTestId('publish-channel-dialog-discord-connect')).toBeNull();
  });
});
