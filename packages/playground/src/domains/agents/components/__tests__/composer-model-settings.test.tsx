import { TooltipProvider } from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { AgentSettingsProvider } from '../../context/agent-context';
import { ComposerModelSettings } from '../composer-model-settings';
import { memoryDisabled, v2Agent } from './fixtures/composer-model-settings';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'agent-1';

const useDefaultHandlers = () => {
  server.use(
    http.get(`${BASE_URL}/api/agents/${AGENT_ID}`, () => HttpResponse.json(v2Agent)),
    http.get(`${BASE_URL}/api/memory/status`, () => HttpResponse.json(memoryDisabled)),
    http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false })),
  );
};

const renderSettings = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TooltipProvider>
            <AgentSettingsProvider agentId={AGENT_ID}>
              <ComposerModelSettings agentId={AGENT_ID} />
            </AgentSettingsProvider>
          </TooltipProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

const openPopover = async () => {
  const trigger = await screen.findByTestId('composer-model-settings-trigger');
  await act(async () => {
    fireEvent.click(trigger);
  });
};

const openAdvancedDialog = async () => {
  await openPopover();
  const advanced = await screen.findByRole('button', { name: /advanced settings/i });
  await act(async () => {
    fireEvent.click(advanced);
  });
  await screen.findByRole('heading', { name: /advanced model settings/i });
};

afterEach(() => {
  cleanup();
  // Clear per-agent localStorage between tests so resetAll/setSettings cannot leak.
  window.localStorage.clear();
});

describe('ComposerModelSettings', () => {
  it('renders a loading skeleton while the agent and memory queries are in flight', async () => {
    let resolveAgent: (() => void) | null = null;
    const agentGate = new Promise<void>(r => {
      resolveAgent = r;
    });
    server.use(
      http.get(`${BASE_URL}/api/agents/${AGENT_ID}`, async () => {
        await agentGate;
        return HttpResponse.json(v2Agent);
      }),
      http.get(`${BASE_URL}/api/memory/status`, () => HttpResponse.json(memoryDisabled)),
      http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false })),
    );

    renderSettings();
    await openPopover();

    expect(await screen.findByTestId('composer-model-settings-skeleton')).not.toBeNull();

    await act(async () => {
      resolveAgent?.();
    });

    await waitFor(() => {
      expect(screen.queryByTestId('composer-model-settings-skeleton')).toBeNull();
    });
  });

  it('renders the popover content once data resolves and exposes the chat method controls', async () => {
    useDefaultHandlers();
    renderSettings();
    await openPopover();

    expect(await screen.findByText('Chat Method')).not.toBeNull();
    // v2 model defaults to the modern Generate/Stream Subscription/Stream options (no Legacy variants).
    expect(document.getElementById('generate')).not.toBeNull();
    expect(document.getElementById('streamSubscription')).not.toBeNull();
    expect(document.getElementById('stream')).not.toBeNull();
    expect(document.getElementById('generateLegacy')).toBeNull();
    expect(document.getElementById('streamLegacy')).toBeNull();
  });

  it('persists legacy stream as an explicit no-subscription fallback', async () => {
    useDefaultHandlers();
    renderSettings();
    await openPopover();

    const legacyStream = document.getElementById('stream');
    expect(legacyStream).not.toBeNull();
    await act(async () => {
      fireEvent.click(legacyStream!);
    });

    const stored = JSON.parse(window.localStorage.getItem(`mastra-agent-store-${AGENT_ID}`) ?? '{}');
    expect(stored.modelSettings.chatWithLegacyStream).toBe(true);
    expect(stored.modelSettings.chatWithGenerate).toBe(false);
    expect(stored.modelSettings.chatWithNetwork).toBe(false);
  });

  it('falls back to stream and disables stream subscription for agents without memory support', async () => {
    server.use(
      http.get(`${BASE_URL}/api/agents/${AGENT_ID}`, () => HttpResponse.json({ ...v2Agent, supportsMemory: false })),
      http.get(`${BASE_URL}/api/memory/status`, () => HttpResponse.json(memoryDisabled)),
      http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false })),
    );

    renderSettings();
    await openPopover();

    expect((document.getElementById('stream') as HTMLInputElement | null)?.checked).toBe(true);
    expect((document.getElementById('streamSubscription') as HTMLInputElement | null)?.disabled).toBe(true);
  });

  it('keeps the popover open when the Advanced Settings dialog is dismissed via its built-in close button', async () => {
    useDefaultHandlers();
    renderSettings();
    await openAdvancedDialog();

    const closeButton = screen.getByRole('button', { name: /close/i });
    await act(async () => {
      fireEvent.click(closeButton);
    });

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /advanced model settings/i })).toBeNull();
    });

    // The popover stays open: the Chat Method label that lives inside it must still be present.
    expect(screen.getByText('Chat Method')).not.toBeNull();
  });

  it('keeps the popover open when the Advanced Settings dialog is closed via Escape', async () => {
    useDefaultHandlers();
    renderSettings();
    await openAdvancedDialog();

    await act(async () => {
      fireEvent.keyDown(document.activeElement ?? document.body, {
        key: 'Escape',
        code: 'Escape',
      });
    });

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /advanced model settings/i })).toBeNull();
    });

    expect(screen.getByText('Chat Method')).not.toBeNull();
  });

  it('closes the popover when Escape is pressed while no Advanced Settings dialog is open', async () => {
    useDefaultHandlers();
    renderSettings();
    await openPopover();

    expect(await screen.findByText('Chat Method')).not.toBeNull();

    // With the dialog closed, Escape is a normal popover dismissal — the
    // guard only suppresses dismissals whose target is inside the dialog id,
    // so this path must still close the popover.
    await act(async () => {
      fireEvent.keyDown(document.activeElement ?? document.body, {
        key: 'Escape',
        code: 'Escape',
      });
    });

    await waitFor(() => {
      expect(screen.queryByText('Chat Method')).toBeNull();
    });
  });
});
