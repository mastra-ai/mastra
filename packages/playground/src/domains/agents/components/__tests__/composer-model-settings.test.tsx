import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
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
    expect(screen.getByRole('radio', { name: 'Generate' })).not.toBeNull();
    expect(screen.getByRole('radio', { name: 'Stream subscription (default)' })).not.toBeNull();
    expect(screen.getByRole('radio', { name: 'Stream' })).not.toBeNull();
    expect(screen.queryByRole('radio', { name: 'Generate (Legacy)' })).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Stream (Legacy)' })).toBeNull();
  });

  it('persists legacy stream as an explicit no-subscription fallback', async () => {
    useDefaultHandlers();
    renderSettings();
    await openPopover();

    const legacyStream = screen.getByRole('radio', { name: 'Stream' });
    await act(async () => {
      fireEvent.click(legacyStream);
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

    expect(screen.getByRole('radio', { name: 'Stream' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Stream subscription (default)' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
  });

  it('persists advanced fields without resetting the selected chat method', async () => {
    useDefaultHandlers();
    renderSettings();
    await openPopover();
    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: 'Generate' }));
      fireEvent.click(screen.getByRole('button', { name: /advanced settings/i }));
    });
    const maxTokens = await screen.findByRole('spinbutton', { name: 'Max Tokens' });
    await act(async () => {
      fireEvent.change(maxTokens, { target: { value: '4096' } });
    });
    const stored = JSON.parse(window.localStorage.getItem(`mastra-agent-store-${AGENT_ID}`) ?? '{}');
    expect(stored.modelSettings.maxTokens).toBe(4096);
    expect(stored.modelSettings.chatWithGenerate).toBe(true);
    await act(async () => {
      fireEvent.change(maxTokens, { target: { value: '' } });
    });
    const cleared = JSON.parse(window.localStorage.getItem(`mastra-agent-store-${AGENT_ID}`) ?? '{}');
    expect(cleared.modelSettings.maxTokens).toBeUndefined();
    expect(cleared.modelSettings.chatWithGenerate).toBe(true);
  });

  describe('when tool approval is enabled with a selected chat method', () => {
    it('keeps both settings when editing model parameters and clears them on reset', async () => {
      useDefaultHandlers();
      renderSettings();
      await openPopover();
      await act(async () => {
        fireEvent.click(screen.getByRole('radio', { name: 'Generate' }));
        fireEvent.click(screen.getByRole('checkbox', { name: 'Require Tool Approval' }));
        fireEvent.click(screen.getByRole('button', { name: /advanced settings/i }));
      });
      await act(async () => {
        fireEvent.change(await screen.findByRole('spinbutton', { name: 'Seed' }), { target: { value: '0' } });
      });
      const stored = JSON.parse(window.localStorage.getItem(`mastra-agent-store-${AGENT_ID}`) ?? '{}');
      expect(stored.modelSettings).toMatchObject({ seed: 0, requireToolApproval: true, chatWithGenerate: true });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /close/i }));
      });
      await waitFor(() => expect(screen.queryByRole('heading', { name: /advanced model settings/i })).toBeNull());
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
      });
      const reset = JSON.parse(window.localStorage.getItem(`mastra-agent-store-${AGENT_ID}`) ?? '{}');
      expect(reset.modelSettings?.requireToolApproval).not.toBe(true);
      expect(reset.modelSettings?.chatWithGenerate).not.toBe(true);
      expect(screen.getByRole('checkbox', { name: 'Require Tool Approval' }).getAttribute('aria-checked')).toBe(
        'false',
      );
    });
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
