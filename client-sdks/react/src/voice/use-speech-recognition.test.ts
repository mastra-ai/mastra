// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// client-js Agent voice spies, surfaced through the mocked MastraClient.getAgent().
const getSpeakersMock = vi.fn(async () => [{ voiceId: 'voice-1' }]);
const listenMock = vi.fn(async () => ({ text: 'mastra transcript' }));
const lastGetAgentArgs: string[] = [];

vi.mock('@mastra/client-js', () => ({
  MastraClient: class MockMastraClient {
    constructor(public options: any) {}
    getAgent(agentId: string) {
      lastGetAgentArgs.push(agentId);
      return {
        voice: {
          getSpeakers: getSpeakersMock,
          listen: listenMock,
        },
      };
    }
  },
}));

// recordMicrophoneToFile is the mic capture helper; stub it so we control onFinish.
let onFinishCapture: ((file: File) => void) | null = null;
const recorderStartMock = vi.fn();
const recorderStopMock = vi.fn();
// When set, recordMicrophoneToFile returns a pending promise resolved by the test.
let deferredResolve: ((recorder: MediaRecorder) => void) | null = null;
let deferRecorder = false;
const makeRecorder = () => ({ start: recorderStartMock, stop: recorderStopMock }) as unknown as MediaRecorder;
const recordMicrophoneToFileMock = vi.fn((onFinish: (file: File) => void) => {
  onFinishCapture = onFinish;
  if (deferRecorder) {
    return new Promise<MediaRecorder>(resolve => {
      deferredResolve = resolve;
    });
  }
  return Promise.resolve(makeRecorder());
});
vi.mock('./record-mic-to-file', () => ({
  recordMicrophoneToFile: (onFinish: (file: File) => void) => recordMicrophoneToFileMock(onFinish),
}));

const { useSpeechRecognition } = await import('./use-speech-recognition');
const { MastraClientProvider } = await import('../mastra-client-context');

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(MastraClientProvider, { baseUrl: 'http://localhost:4111', children });

// Controllable browser SpeechRecognition stub.
let lastRecognition: {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  continuous: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
};

const installSpeechRecognition = () => {
  class FakeSpeechRecognition {
    start = vi.fn(() => this.onstart?.());
    stop = vi.fn(() => this.onend?.());
    continuous = false;
    lang = '';
    onstart: (() => void) | null = null;
    onresult: ((event: any) => void) | null = null;
    onerror: ((event: any) => void) | null = null;
    onend: (() => void) | null = null;
    constructor() {
      lastRecognition = this;
    }
  }
  (window as any).SpeechRecognition = FakeSpeechRecognition;
  (window as any).webkitSpeechRecognition = FakeSpeechRecognition;
};

beforeEach(() => {
  getSpeakersMock.mockClear();
  getSpeakersMock.mockResolvedValue([{ voiceId: 'voice-1' }]);
  listenMock.mockClear();
  recordMicrophoneToFileMock.mockClear();
  recorderStartMock.mockClear();
  recorderStopMock.mockClear();
  lastGetAgentArgs.length = 0;
  onFinishCapture = null;
  deferredResolve = null;
  deferRecorder = false;
});

afterEach(() => {
  delete (window as any).SpeechRecognition;
  delete (window as any).webkitSpeechRecognition;
  vi.clearAllMocks();
});

describe('useSpeechRecognition (browser path)', () => {
  it('reports an error when the browser does not support speech recognition', async () => {
    const { result } = renderHook(() => useSpeechRecognition({}), { wrapper });
    // No agentId, no SpeechRecognition installed → start/stop are no-ops, no throw.
    act(() => result.current.start());
    expect(result.current.isListening).toBe(false);
  });

  it('drives the browser recognition and updates transcript from final results', async () => {
    installSpeechRecognition();
    const { result } = renderHook(() => useSpeechRecognition({ language: 'fr-FR' }), { wrapper });

    expect(lastRecognition.continuous).toBe(true);
    expect(lastRecognition.lang).toBe('fr-FR');

    act(() => result.current.start());
    expect(lastRecognition.start).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.isListening).toBe(true));

    act(() => {
      lastRecognition.onresult?.({
        resultIndex: 0,
        results: [{ 0: { transcript: 'hello world' }, isFinal: true }],
      });
    });
    await waitFor(() => expect(result.current.transcript).toBe('hello world '));

    act(() => result.current.stop());
    expect(lastRecognition.stop).toHaveBeenCalledTimes(1);
  });

  it('stops recognition and clears handlers on unmount', async () => {
    installSpeechRecognition();
    const { unmount } = renderHook(() => useSpeechRecognition({}), { wrapper });

    const recognition = lastRecognition;
    expect(recognition.onresult).not.toBeNull();

    unmount();

    expect(recognition.stop).toHaveBeenCalledTimes(1);
    expect(recognition.onstart).toBeNull();
    expect(recognition.onresult).toBeNull();
    expect(recognition.onerror).toBeNull();
    expect(recognition.onend).toBeNull();
  });

  it('stops the previous recognition when language changes', async () => {
    installSpeechRecognition();
    const { rerender } = renderHook(({ language }) => useSpeechRecognition({ language }), {
      initialProps: { language: 'en-US' },
      wrapper,
    });

    const first = lastRecognition;
    rerender({ language: 'fr-FR' });

    expect(first.stop).toHaveBeenCalledTimes(1);
    expect(first.onresult).toBeNull();
    expect(lastRecognition).not.toBe(first);
    expect(lastRecognition.lang).toBe('fr-FR');
  });
});

describe('useSpeechRecognition (mastra path)', () => {
  it('switches to the mastra agent when speakers are available', async () => {
    installSpeechRecognition();
    const { result } = renderHook(() => useSpeechRecognition({ agentId: 'agent-1' }), { wrapper });

    await waitFor(() => expect(getSpeakersMock).toHaveBeenCalled());
    expect(lastGetAgentArgs).toContain('agent-1');

    await waitFor(() => {
      act(() => result.current.start());
      expect(recordMicrophoneToFileMock).toHaveBeenCalled();
    });
    expect(recorderStartMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.isListening).toBe(true));

    await act(async () => {
      onFinishCapture?.(new File(['audio'], 'rec.webm', { type: 'audio/webm' }));
    });
    await waitFor(() => expect(listenMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.transcript).toBe('mastra transcript'));

    act(() => result.current.stop());
    await waitFor(() => expect(result.current.isListening).toBe(false));
  });

  it('forwards requestContext to getSpeakers and language to listen', async () => {
    installSpeechRecognition();
    const requestContext = { user: 'u1' } as any;
    const { result } = renderHook(
      () => useSpeechRecognition({ agentId: 'agent-1', requestContext, language: 'fr-FR' }),
      {
        wrapper,
      },
    );

    await waitFor(() => expect(getSpeakersMock).toHaveBeenCalledWith(requestContext));

    await waitFor(() => {
      act(() => result.current.start());
      expect(recordMicrophoneToFileMock).toHaveBeenCalled();
    });

    await act(async () => {
      onFinishCapture?.(new File(['audio'], 'rec.webm', { type: 'audio/webm' }));
    });

    await waitFor(() => expect(listenMock).toHaveBeenCalledWith(expect.any(File), { language: 'fr-FR' }));
  });

  it('resets to the browser path when agentId is removed', async () => {
    installSpeechRecognition();
    const { result, rerender } = renderHook(({ agentId }) => useSpeechRecognition({ agentId }), {
      initialProps: { agentId: 'agent-1' as string | undefined },
      wrapper,
    });

    await waitFor(() => expect(getSpeakersMock).toHaveBeenCalled());

    await waitFor(() => {
      act(() => result.current.start());
      expect(recordMicrophoneToFileMock).toHaveBeenCalledTimes(1);
    });

    rerender({ agentId: undefined });

    act(() => result.current.start());
    expect(lastRecognition.start).toHaveBeenCalled();
    expect(recordMicrophoneToFileMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces Mastra listen errors and clears listening state', async () => {
    installSpeechRecognition();
    listenMock.mockRejectedValueOnce(new Error('listen failed'));
    const { result } = renderHook(() => useSpeechRecognition({ agentId: 'agent-1' }), { wrapper });

    await waitFor(() => expect(getSpeakersMock).toHaveBeenCalled());

    await waitFor(() => {
      act(() => result.current.start());
      expect(recordMicrophoneToFileMock).toHaveBeenCalled();
    });
    await waitFor(() => expect(result.current.isListening).toBe(true));

    await act(async () => {
      onFinishCapture?.(new File(['audio'], 'rec.webm', { type: 'audio/webm' }));
    });

    await waitFor(() => expect(result.current.isListening).toBe(false));
    await waitFor(() => expect(result.current.error).toBe('listen failed'));
  });

  it('stays on the browser path when there are no speakers', async () => {
    installSpeechRecognition();
    getSpeakersMock.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useSpeechRecognition({ agentId: 'agent-1' }), { wrapper });

    await waitFor(() => expect(getSpeakersMock).toHaveBeenCalled());
    act(() => result.current.start());
    expect(lastRecognition.start).toHaveBeenCalled();
    expect(recordMicrophoneToFileMock).not.toHaveBeenCalled();
  });

  it('stays on the browser path when getSpeakers throws', async () => {
    installSpeechRecognition();
    getSpeakersMock.mockRejectedValueOnce(new Error('no voice'));
    const { result } = renderHook(() => useSpeechRecognition({ agentId: 'agent-1' }), { wrapper });

    await waitFor(() => expect(getSpeakersMock).toHaveBeenCalled());
    act(() => result.current.start());
    expect(lastRecognition.start).toHaveBeenCalled();
    expect(recordMicrophoneToFileMock).not.toHaveBeenCalled();
  });

  it('only creates one recorder and one listen call when start() is called twice before resolving', async () => {
    installSpeechRecognition();
    deferRecorder = true;
    const { result } = renderHook(() => useSpeechRecognition({ agentId: 'agent-1' }), { wrapper });

    await waitFor(() => expect(getSpeakersMock).toHaveBeenCalled());

    // Retry start() until the hook has switched to the mastra path (getSpeakers
    // resolving into state is async); the in-flight guard makes extra calls no-ops.
    await waitFor(() => {
      act(() => result.current.start());
      expect(recordMicrophoneToFileMock).toHaveBeenCalledTimes(1);
    });

    // Second start while the first recordMicrophoneToFile is still pending.
    act(() => result.current.start());

    // The in-flight guard should have prevented a second recordMicrophoneToFile call.
    expect(recordMicrophoneToFileMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      deferredResolve?.(makeRecorder());
    });
    expect(recorderStartMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      onFinishCapture?.(new File(['audio'], 'rec.webm', { type: 'audio/webm' }));
    });
    await waitFor(() => expect(listenMock).toHaveBeenCalledTimes(1));
  });

  it('does not transcribe when stop() runs before the recorder resolves', async () => {
    installSpeechRecognition();
    deferRecorder = true;
    const { result } = renderHook(() => useSpeechRecognition({ agentId: 'agent-1' }), { wrapper });

    await waitFor(() => expect(getSpeakersMock).toHaveBeenCalled());

    // Retry start() until the hook has switched to the mastra path (getSpeakers
    // resolving into state is async); the in-flight guard makes extra calls no-ops.
    await waitFor(() => {
      act(() => result.current.start());
      expect(recordMicrophoneToFileMock).toHaveBeenCalledTimes(1);
    });

    act(() => result.current.stop());

    await act(async () => {
      deferredResolve?.(makeRecorder());
    });

    // The stale recorder is stopped, not started, and onstop must not transcribe.
    expect(recorderStartMock).not.toHaveBeenCalled();
    expect(recorderStopMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      onFinishCapture?.(new File(['audio'], 'rec.webm', { type: 'audio/webm' }));
    });
    expect(listenMock).not.toHaveBeenCalled();
  });

  it('transcribes a normal stop on an active recorder (regression for #19980)', async () => {
    // Prior bug: stop() bumped sessionRef before the recorder's async onstop
    // could fire, so handleFinish's session check always failed and
    // voice.listen() was silently never called on a normal, successful stop.
    installSpeechRecognition();
    const { result } = renderHook(() => useSpeechRecognition({ agentId: 'agent-1' }), { wrapper });

    await waitFor(() => expect(getSpeakersMock).toHaveBeenCalled());

    await waitFor(() => {
      act(() => result.current.start());
      expect(recordMicrophoneToFileMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => expect(result.current.isListening).toBe(true));

    // Recorder is now active. A normal stop() should NOT invalidate this
    // recording's session -- the recorder's own onstop must still transcribe.
    act(() => result.current.stop());
    expect(recorderStopMock).toHaveBeenCalledTimes(1);

    // Simulate the recorder's async onstop firing after stop() returns.
    await act(async () => {
      onFinishCapture?.(new File(['audio'], 'rec.webm', { type: 'audio/webm' }));
    });

    await waitFor(() => expect(listenMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.transcript).toBe('mastra transcript'));
  });
});
