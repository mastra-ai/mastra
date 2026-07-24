import type { GetSystemPackagesResponse } from '@mastra/client-js';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AgentPlaygroundTestChat } from '../agent-playground/agent-playground-test-chat';
import { memoryDisabled, v2Agent } from './fixtures/composer-model-settings';
import { TracingSettingsProvider } from '@/domains/observability/context/tracing-settings-context';
import { SchemaRequestContextProvider } from '@/domains/request-context/context/schema-request-context';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'agent-1';

const systemPackagesWithLiveKit: GetSystemPackagesResponse = {
  packages: [],
  isDev: false,
  cmsEnabled: false,
  observabilityEnabled: false,
  liveKitConnectionRouteEnabled: true,
};

const renderEditorTestChat = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TooltipProvider>
            <TracingSettingsProvider entityId={AGENT_ID} entityType="agent">
              <SchemaRequestContextProvider>
                <AgentPlaygroundTestChat
                  agentId={AGENT_ID}
                  agentName="Test Agent"
                  modelVersion="v2"
                  hasMemory={false}
                />
              </SchemaRequestContextProvider>
            </TracingSettingsProvider>
          </TooltipProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('AgentPlaygroundTestChat', () => {
  it('renders request context in the composer and mounts browser tooling with provider parity', async () => {
    const onBrowserProbe = vi.fn();

    server.use(
      http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(systemPackagesWithLiveKit)),
      http.get(`${BASE_URL}/api/agents/${AGENT_ID}`, () =>
        HttpResponse.json({
          ...v2Agent,
          browserTools: ['browser_goto'],
          modelList: [],
        }),
      ),
      http.get(`${BASE_URL}/api/agents/${AGENT_ID}/browser/session`, () => {
        onBrowserProbe();
        return HttpResponse.json({ hasSession: false, screencastAvailable: false });
      }),
      http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json({ config: {} })),
      http.get(`${BASE_URL}/api/memory/status`, () => HttpResponse.json(memoryDisabled)),
      http.get(`${BASE_URL}/api/agents/${AGENT_ID}/voice/speakers`, () => HttpResponse.json([])),
      http.post(`${BASE_URL}/api/agents/${AGENT_ID}/threads/subscribe`, () => HttpResponse.json({ ok: true })),
      http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false, login: null })),
      http.get(`${BASE_URL}/api/agents/providers`, () => HttpResponse.json({ providers: [] })),
      http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json({ enabled: false })),
      http.get(`${BASE_URL}/api/editor/builder/models/available`, () => HttpResponse.json({ providers: [] })),
    );

    renderEditorTestChat();

    const runOptionsTrigger = await screen.findByTestId('composer-run-options-trigger');
    expect(runOptionsTrigger.closest('form')).not.toBeNull();
    expect(screen.getByRole('dialog', { name: /browser view/i, hidden: true })).not.toBeNull();

    await waitFor(() => {
      expect(onBrowserProbe).toHaveBeenCalled();
    });
  });

  it('accepts typed input in the composer textarea', async () => {
    server.use(
      http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(systemPackagesWithLiveKit)),
      http.get(`${BASE_URL}/api/agents/${AGENT_ID}`, () => HttpResponse.json({ ...v2Agent, modelList: [] })),
      http.get(`${BASE_URL}/api/memory/config`, () => HttpResponse.json({ config: {} })),
      http.get(`${BASE_URL}/api/memory/status`, () => HttpResponse.json(memoryDisabled)),
      http.get(`${BASE_URL}/api/agents/${AGENT_ID}/voice/speakers`, () => HttpResponse.json([])),
      http.post(`${BASE_URL}/api/agents/${AGENT_ID}/threads/subscribe`, () => HttpResponse.json({ ok: true })),
      http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false, login: null })),
      http.get(`${BASE_URL}/api/agents/providers`, () => HttpResponse.json({ providers: [] })),
      http.get(`${BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json({ enabled: false })),
      http.get(`${BASE_URL}/api/editor/builder/models/available`, () => HttpResponse.json({ providers: [] })),
    );

    await act(async () => {
      renderEditorTestChat();
    });

    const textarea = await screen.findByPlaceholderText<HTMLTextAreaElement>('Enter your message...');
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'hello from the editor composer' } });
    });

    expect(textarea.value).toBe('hello from the editor composer');
  });
});
