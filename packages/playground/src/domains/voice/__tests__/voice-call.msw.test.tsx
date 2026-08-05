// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VoiceCallButton } from '../components/voice-call-button';
import { VoiceCallPanel } from '../components/voice-call-panel';
import { useVoiceCall } from '../hooks/use-voice-call';
import { connectionDetails } from './fixtures/connection-details';
import { StudioConfigContext } from '@/domains/configuration';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

type EventHandler = (...args: unknown[]) => void;
type TextStreamHandler = (
  reader: {
    info: { id: string; attributes?: Record<string, string> };
    [Symbol.asyncIterator]: () => AsyncIterator<string>;
  },
  participantInfo: { identity: string },
) => Promise<void>;

interface FakeRoomShape {
  handlers: Map<string, EventHandler>;
  textStreamHandler?: TextStreamHandler;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  localParticipant: { setMicrophoneEnabled: ReturnType<typeof vi.fn> };
}

const fakeRooms: FakeRoomShape[] = [];

// livekit-client opens real WebRTC connections; stub the SDK boundary and drive
// the connection-details endpoint through MSW like any other network call.
vi.mock('livekit-client', () => {
  class FakeRoom implements FakeRoomShape {
    handlers = new Map<string, EventHandler>();
    textStreamHandler?: TextStreamHandler;
    connect = vi.fn(async () => {});
    disconnect = vi.fn(async () => {});
    localParticipant = { setMicrophoneEnabled: vi.fn(async () => {}) };
    constructor() {
      fakeRooms.push(this);
    }
    on(event: string, handler: EventHandler) {
      this.handlers.set(event, handler);
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

const VoiceHarness = ({ onCallStarted }: { onCallStarted?: () => void }) => {
  const voiceCall = useVoiceCall({ agentId: 'support', threadId: 'thread-1', onCallStarted });
  return (
    <>
      <VoiceCallPanel voiceCall={voiceCall} />
      <VoiceCallButton voiceCall={voiceCall} />
    </>
  );
};

const renderHarness = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  const onCallStarted = vi.fn();
  const view = render(
    <StudioConfigContext.Provider
      value={{ baseUrl: BASE_URL, headers: {}, apiPrefix: undefined, isLoading: false, setConfig: () => {} }}
    >
      <QueryClientProvider client={queryClient}>
        <VoiceHarness onCallStarted={onCallStarted} />
      </QueryClientProvider>
    </StudioConfigContext.Provider>,
  );
  return { ...view, invalidateSpy, onCallStarted };
};

function textStreamReader(id: string, chunks: string[], attributes: Record<string, string> = {}) {
  return {
    info: { id, attributes },
    [Symbol.asyncIterator]: () => {
      let index = 0;
      return {
        next: async () =>
          index < chunks.length
            ? { value: chunks[index++]!, done: false as const }
            : { value: undefined, done: true as const },
      };
    },
  };
}

afterEach(() => {
  cleanup();
  fakeRooms.length = 0;
});

describe('voice call', () => {
  it('starts a call: fetches connection details, joins the room, and enables the mic', async () => {
    const onConnectionDetails = vi.fn<(body: unknown) => void>();
    server.use(
      http.post(`${BASE_URL}/voice/livekit/connection-details`, async ({ request }) => {
        onConnectionDetails(await request.json());
        return HttpResponse.json(connectionDetails);
      }),
    );

    const { invalidateSpy, onCallStarted } = renderHarness();
    fireEvent.click(screen.getByTestId('voice-call-button'));

    await waitFor(() => expect(fakeRooms).toHaveLength(1));
    const room = fakeRooms[0]!;
    // resourceId matches the sidebar's listing convention so the call's thread is visible.
    expect(onConnectionDetails).toHaveBeenCalledWith({
      agentId: 'support',
      threadId: 'thread-1',
      resourceId: 'support',
    });
    await waitFor(() =>
      expect(room.connect).toHaveBeenCalledWith(connectionDetails.serverUrl, connectionDetails.participantToken),
    );
    await waitFor(() => expect(room.localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true));
    expect(screen.getByTestId('voice-call-panel')).not.toBeNull();
    // The worker created the call's thread on session start; the sidebar refreshes.
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['memory', 'threads', 'support', 'support'] }),
    );
    // The chat's refreshThreadList runs so a brand-new chat navigates to its thread URL.
    await waitFor(() => expect(onCallStarted).toHaveBeenCalledTimes(1));
  });

  it('shows agent state changes and live captions', async () => {
    server.use(http.post(`${BASE_URL}/voice/livekit/connection-details`, () => HttpResponse.json(connectionDetails)));

    const { invalidateSpy } = renderHarness();
    fireEvent.click(screen.getByTestId('voice-call-button'));
    await waitFor(() => expect(fakeRooms).toHaveLength(1));
    const room = fakeRooms[0]!;
    await waitFor(() => expect(room.localParticipant.setMicrophoneEnabled).toHaveBeenCalled());

    act(() => {
      room.handlers.get('participantAttributesChanged')?.(
        { 'lk.agent.state': 'thinking' },
        { identity: 'agent-AJ_x', attributes: {} },
      );
    });
    expect(await screen.findByText('Thinking…')).not.toBeNull();

    await act(async () => {
      await room.textStreamHandler?.(textStreamReader('seg-1', ['What is ', 'the weather?']), {
        identity: connectionDetails.participantName,
      });
      await room.textStreamHandler?.(textStreamReader('seg-2', ['Sunny ', 'and 21 degrees.']), {
        identity: 'agent-AJ_x',
      });
    });

    expect((await screen.findByTestId('voice-caption-user')).textContent).toBe('What is the weather?');
    expect((await screen.findByTestId('voice-caption-agent')).textContent).toBe('Sunny and 21 degrees.');

    // A finished agent segment marks a completed turn: the chat refetches (debounced).
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['memory', 'messages', 'thread-1'] }), {
      timeout: 2000,
    });
  });

  it('hangs up: disconnects the room and refreshes the thread messages', async () => {
    server.use(http.post(`${BASE_URL}/voice/livekit/connection-details`, () => HttpResponse.json(connectionDetails)));

    const { invalidateSpy } = renderHarness();
    fireEvent.click(screen.getByTestId('voice-call-button'));
    await waitFor(() => expect(fakeRooms).toHaveLength(1));
    const room = fakeRooms[0]!;
    await waitFor(() => expect(room.localParticipant.setMicrophoneEnabled).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId('voice-call-button'));

    // disconnect and the thread invalidation both settle asynchronously; await them.
    await waitFor(() => expect(room.disconnect).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByTestId('voice-call-panel')).toBeNull());
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['memory', 'messages', 'thread-1'] }));
  });

  it('returns to idle and surfaces the server error when LiveKit is not configured', async () => {
    server.use(
      http.post(`${BASE_URL}/voice/livekit/connection-details`, () =>
        HttpResponse.json({ error: 'LiveKit is not configured.' }, { status: 500 }),
      ),
    );

    renderHarness();
    fireEvent.click(screen.getByTestId('voice-call-button'));

    await waitFor(() => expect(screen.queryByTestId('voice-call-panel')).toBeNull());
    expect(fakeRooms).toHaveLength(0);
  });

  it('aborts an in-flight start when the hook unmounts: no room is connected', async () => {
    // Gate the connection-details response so the call is stuck in 'connecting' when we
    // tear the hook down.
    let release: () => void = () => {};
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    server.use(
      http.post(`${BASE_URL}/voice/livekit/connection-details`, async () => {
        await gate;
        return HttpResponse.json(connectionDetails);
      }),
    );

    const { unmount } = renderHarness();
    fireEvent.click(screen.getByTestId('voice-call-button'));
    // 'connecting' state is live with the fetch in flight.
    await waitFor(() => expect(screen.getByTestId('voice-call-panel')).not.toBeNull());

    // Unmount mid-connect, then let the (now superseded) fetch settle.
    unmount();
    await act(async () => {
      release();
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    // The superseded start neither constructs nor connects a room.
    expect(fakeRooms).toHaveLength(0);
  });
});
