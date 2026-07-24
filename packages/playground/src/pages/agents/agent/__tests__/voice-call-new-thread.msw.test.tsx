// @vitest-environment jsdom
import type { GetSystemPackagesResponse } from '@mastra/client-js';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AgentPage from '../index';
import { StudioConfigContext } from '@/domains/configuration';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const AGENT_ID = 'call-center';
const GREETING = 'Thanks for calling BrightSmile Dental, this is Riley.';

const systemPackagesWithLiveKit: GetSystemPackagesResponse = {
  packages: [],
  isDev: false,
  cmsEnabled: false,
  observabilityEnabled: false,
  liveKitConnectionRouteEnabled: true,
};

// Heavy presentational siblings with their own coverage — the page state machine,
// AgentChat, Thread, and the voice hook stay real.
vi.mock('@/domains/agents/agent-sidebar', () => ({
  AgentSidebar: () => <div data-testid="stub-sidebar" />,
}));
vi.mock('@/domains/agents/components/agent-information/agent-information', () => ({
  AgentInformation: () => <div data-testid="stub-agent-information" />,
}));
vi.mock('@/domains/agents/components/browser-view', () => ({
  BrowserViewPanel: () => null,
}));
vi.mock('@/domains/agents/components/agent-layout', () => ({
  AgentLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

type TextStreamHandler = (
  reader: {
    info: { id: string; attributes?: Record<string, string> };
    [Symbol.asyncIterator]: () => AsyncIterator<string>;
  },
  participantInfo: { identity: string },
) => Promise<void>;

interface FakeRoomShape {
  textStreamHandler?: TextStreamHandler;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  localParticipant: { setMicrophoneEnabled: ReturnType<typeof vi.fn> };
}

const fakeRooms: FakeRoomShape[] = [];

vi.mock('livekit-client', () => {
  class FakeRoom implements FakeRoomShape {
    textStreamHandler?: TextStreamHandler;
    connect = vi.fn(async () => {});
    disconnect = vi.fn(async () => {});
    localParticipant = { setMicrophoneEnabled: vi.fn(async () => {}) };
    constructor() {
      fakeRooms.push(this);
    }
    on() {
      return this;
    }
    registerTextStreamHandler(_topic: string, handler: TextStreamHandler) {
      this.textStreamHandler = handler;
    }
  }
  return {
    Room: FakeRoom,
    RoomEvent: {
      TrackSubscribed: 'trackSubscribed',
      ParticipantAttributesChanged: 'participantAttributesChanged',
      Disconnected: 'disconnected',
    },
    Track: { Kind: { Audio: 'audio' } },
  };
});

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname}</div>;
};

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <StudioConfigContext.Provider
      value={{ baseUrl: BASE_URL, headers: {}, apiPrefix: undefined, isLoading: false, setConfig: () => {} }}
    >
      <MastraReactProvider baseUrl={BASE_URL}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[`/agents/${AGENT_ID}/chat/new`]}>
            <LocationProbe />
            <Routes>
              <Route path="/agents/:agentId/chat/:threadId" element={<AgentPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </MastraReactProvider>
    </StudioConfigContext.Provider>,
  );
};

function installHandlers() {
  // The worker "creates" the thread and persists the greeting when the call connects.
  let callStarted = false;
  server.use(
    http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(systemPackagesWithLiveKit)),
    http.post(`${BASE_URL}/voice/livekit/connection-details`, () => {
      callStarted = true;
      return HttpResponse.json({
        serverUrl: 'wss://example.livekit.cloud',
        roomName: 'mastra-voice-test',
        participantName: 'user-9',
        participantToken: 'header.payload.signature',
      });
    }),
    http.get(`${BASE_URL}/api/agents/${AGENT_ID}`, () =>
      HttpResponse.json({
        id: AGENT_ID,
        name: 'BrightSmile Call Center',
        instructions: 'help callers',
        tools: {},
        workflows: {},
        provider: 'openai',
        modelId: 'openai/gpt-5-mini',
        modelVersion: 'v2',
        supportsMemory: true,
        defaultOptions: {},
      }),
    ),
    http.get(`${BASE_URL}/api/memory/status`, () => HttpResponse.json({ result: true, memoryType: 'local' })),
    http.get(`${BASE_URL}/api/memory/threads`, () =>
      HttpResponse.json(
        callStarted
          ? {
              threads: [
                {
                  id: 'ignored',
                  resourceId: AGENT_ID,
                  title: 'Voice call',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ],
            }
          : { threads: [] },
      ),
    ),
    http.get(`${BASE_URL}/api/memory/threads/:threadId/messages`, () =>
      HttpResponse.json(
        callStarted
          ? {
              messages: [
                {
                  id: 'msg-greeting',
                  role: 'assistant',
                  type: 'text',
                  createdAt: new Date().toISOString(),
                  content: { format: 2, parts: [{ type: 'text', text: GREETING }] },
                },
              ],
            }
          : { messages: [] },
      ),
    ),
  );
}

afterEach(() => {
  cleanup();
  fakeRooms.length = 0;
});

describe('voice call from a brand-new chat (/chat/new)', () => {
  it('navigates to the thread URL and shows persisted messages in the chat', async () => {
    installHandlers();
    renderPage();

    // Page renders in new-thread state with the voice button available.
    const button = await screen.findByTestId('voice-call-button');
    expect(screen.getByTestId('location-probe').textContent).toBe(`/agents/${AGENT_ID}/chat/new`);

    fireEvent.click(button);

    // The call connecting must transition the page out of /chat/new (like a text send).
    await waitFor(() => {
      const path = screen.getByTestId('location-probe').textContent!;
      expect(path).toMatch(new RegExp(`^/agents/${AGENT_ID}/chat/(?!new$).+`));
    });

    // With the messages query now enabled, the persisted greeting appears in the chat.
    expect(await screen.findByText(GREETING)).not.toBeNull();
  });
});
