// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AgentBuilderEditFormValues } from '../../../../schemas';
import { Integrations } from '../integrations';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

// useEditPage is provided by EditPageProvider in production. For unit tests
// we mock it to expose only the slice the Integrations tab reads.
const editPageState = vi.hoisted(() => ({ canPublishToChannel: false }));
vi.mock('@/domains/agent-builder/contexts/edit-page-context', () => ({
  useEditPage: () => ({ canPublishToChannel: editPageState.canPublishToChannel }),
}));

interface HarnessProps {
  visibility: AgentBuilderEditFormValues['visibility'];
  children: ReactNode;
}

const Harness = ({ visibility, children }: HarnessProps) => {
  const methods = useForm<AgentBuilderEditFormValues>({
    defaultValues: { name: '', instructions: '', visibility },
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

const slackHandlers = (installations: unknown[] = []) => [
  http.get('*/api/channels/platforms', () => HttpResponse.json([{ id: 'slack', name: 'Slack', isConfigured: true }])),
  http.get('*/api/channels/:platform/installations', () => HttpResponse.json(installations)),
];

const renderIntegrations = (visibility: AgentBuilderEditFormValues['visibility']) => {
  editPageState.canPublishToChannel = visibility === 'public';
  return render(
    <Harness visibility={visibility}>
      <Integrations agentId="agent-1" />
    </Harness>,
  );
};

describe('Integrations tab', () => {
  beforeAll(() => {
    installRadixDomShims();
  });

  afterEach(() => {
    cleanup();
    editPageState.canPublishToChannel = false;
  });

  it('public + Slack not installed → clicking the card calls /connect directly without a dialog', async () => {
    let connectCalled = false;
    server.use(
      ...slackHandlers(),
      http.post('*/api/channels/slack/connect', () => {
        connectCalled = true;
        return HttpResponse.json({ type: 'oauth', authorizationUrl: 'https://slack.example/oauth' });
      }),
    );

    renderIntegrations('public');

    const card = await screen.findByTestId('integration-card-slack');
    fireEvent.click(card);

    await waitFor(() => expect(connectCalled).toBe(true));
    expect(screen.queryByTestId('agent-builder-publish-before-connect-dialog')).toBeNull();
    expect(screen.queryByTestId('publish-channel-dialog-slack')).toBeNull();
  });

  it('public + Slack installed → clicking the card opens the channel dialog', async () => {
    server.use(
      ...slackHandlers([
        { id: 'inst-1', platform: 'slack', agentId: 'agent-1', status: 'active', displayName: 'Acme' },
      ]),
    );

    renderIntegrations('public');

    const card = await screen.findByTestId('integration-card-slack');
    // Wait for installations query to resolve so the card has the active
    // installation cached before we click.
    await screen.findByText('Connected');
    fireEvent.click(card);

    expect(await screen.findByTestId('publish-channel-dialog-slack')).toBeTruthy();
    expect(screen.queryByTestId('agent-builder-publish-before-connect-dialog')).toBeNull();
  });

  it('private + Slack not installed → confirming the dialog PATCHes visibility=public and then calls /connect', async () => {
    let connectCalled = false;
    let capturedBody: any = null;
    server.use(
      ...slackHandlers(),
      http.patch(`${BASE_URL}/api/stored/agents/agent-1`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ id: 'agent-1', visibility: 'public' });
      }),
      http.post('*/api/channels/slack/connect', () => {
        connectCalled = true;
        return HttpResponse.json({ type: 'oauth', authorizationUrl: 'https://slack.example/oauth' });
      }),
    );

    renderIntegrations('private');

    const card = await screen.findByTestId('integration-card-slack');
    fireEvent.click(card);

    expect(await screen.findByTestId('agent-builder-publish-before-connect-dialog')).toBeTruthy();
    expect(connectCalled).toBe(false);

    await act(async () => {
      fireEvent.click(screen.getByTestId('agent-builder-publish-before-connect-dialog-confirm'));
    });

    await waitFor(() => expect(capturedBody).toEqual({ visibility: 'public' }));
    await waitFor(() => expect(connectCalled).toBe(true));
    expect(screen.getByTestId('form-visibility').textContent).toBe('public');
  });

  it('private + Slack installed → confirming the dialog PATCHes visibility=public and then opens the channel dialog', async () => {
    let capturedBody: any = null;
    server.use(
      ...slackHandlers([
        { id: 'inst-1', platform: 'slack', agentId: 'agent-1', status: 'active', displayName: 'Acme' },
      ]),
      http.patch(`${BASE_URL}/api/stored/agents/agent-1`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ id: 'agent-1', visibility: 'public' });
      }),
    );

    renderIntegrations('private');

    const card = await screen.findByTestId('integration-card-slack');
    // Wait for installations query to resolve so the card knows it's installed.
    await screen.findByText('Connected');
    fireEvent.click(card);

    expect(await screen.findByTestId('agent-builder-publish-before-connect-dialog')).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByTestId('agent-builder-publish-before-connect-dialog-confirm'));
    });

    await waitFor(() => expect(capturedBody).toEqual({ visibility: 'public' }));
    expect(await screen.findByTestId('publish-channel-dialog-slack')).toBeTruthy();
  });

  it('cancelling the confirm dialog does not PATCH or connect', async () => {
    let connectCalled = false;
    let patchCalled = false;
    server.use(
      ...slackHandlers(),
      http.patch(`${BASE_URL}/api/stored/agents/agent-1`, () => {
        patchCalled = true;
        return HttpResponse.json({ id: 'agent-1', visibility: 'public' });
      }),
      http.post('*/api/channels/slack/connect', () => {
        connectCalled = true;
        return HttpResponse.json({ type: 'oauth', authorizationUrl: 'https://slack.example/oauth' });
      }),
    );

    renderIntegrations('private');

    const card = await screen.findByTestId('integration-card-slack');
    fireEvent.click(card);

    expect(await screen.findByTestId('agent-builder-publish-before-connect-dialog')).toBeTruthy();
    fireEvent.click(screen.getByTestId('agent-builder-publish-before-connect-dialog-cancel'));

    await waitFor(() => expect(screen.queryByTestId('agent-builder-publish-before-connect-dialog')).toBeNull());
    expect(patchCalled).toBe(false);
    expect(connectCalled).toBe(false);
  });

  it('failed PATCH does not call /connect and leaves the dialog open', async () => {
    let connectCalled = false;
    server.use(
      ...slackHandlers(),
      http.patch(`${BASE_URL}/api/stored/agents/agent-1`, () =>
        HttpResponse.json({ message: 'nope' }, { status: 500 }),
      ),
      http.post('*/api/channels/slack/connect', () => {
        connectCalled = true;
        return HttpResponse.json({ type: 'oauth', authorizationUrl: 'https://slack.example/oauth' });
      }),
    );

    renderIntegrations('private');

    const card = await screen.findByTestId('integration-card-slack');
    fireEvent.click(card);

    await screen.findByTestId('agent-builder-publish-before-connect-dialog');

    await act(async () => {
      fireEvent.click(screen.getByTestId('agent-builder-publish-before-connect-dialog-confirm'));
    });

    await waitFor(() => {
      // mutation finished — the form value must still be private
      expect(screen.getByTestId('form-visibility').textContent).toBe('private');
    });
    expect(connectCalled).toBe(false);
    expect(screen.queryByTestId('publish-channel-dialog-slack')).toBeNull();
  });
});
