import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, ws } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import type { LiveSessionResponse } from '../../../../../api/types';
import { renderThread, stubPreparingSession } from './composer-session-test-fixture';
import { acceptTranscribe, answerLiveSession, composerReady, stubVoiceSettings } from './voice-dictation-test-fixture';

const REALTIME_URL = 'wss://api.mistral.ai/v1/audio/transcriptions/realtime';
const realtime = ws.link(`${REALTIME_URL}*`);

const liveMode: LiveSessionResponse = {
  mode: 'live',
  url: `${REALTIME_URL}?model=voxtral-mini-transcribe-realtime-3`,
  token: 'rt_test_token',
  expiresAt: '2026-11-05T10:15:00Z',
};

/** Web Audio stand-ins: jsdom has no audio graph, so the test plays the worklet's part by posting mic frames. */
const contexts: FakeAudioContext[] = [];
const nodes: FakeAudioWorkletNode[] = [];

class FakeAudioContext {
  sampleRate = 48_000;
  state: 'running' | 'closed' = 'running';
  destination = {};
  audioWorklet = { addModule: async () => {} };
  constructor() {
    contexts.push(this);
  }
  createMediaStreamSource() {
    return { connect() {}, disconnect() {} };
  }
  async close() {
    this.state = 'closed';
  }
}

class FakeAudioWorkletNode {
  port: { onmessage: ((event: MessageEvent<unknown>) => void) | null } = { onmessage: null };
  constructor() {
    nodes.push(this);
  }
  connect() {}
  disconnect() {}
}

const stopTrack = vi.fn();
const getUserMedia = vi.fn();

async function speak(milliseconds: number) {
  await waitFor(() => expect(nodes.at(-1)?.port.onmessage).toBeTypeOf('function'));
  const frame = new Float32Array((48_000 * milliseconds) / 1000).fill(0.1);
  nodes.at(-1)?.port.onmessage?.(new MessageEvent('message', { data: frame }));
}

interface RealtimeSession {
  protocols: string | string[] | undefined;
  received: Array<{ type: string; [key: string]: unknown }>;
  closed: boolean;
  say(event: Record<string, unknown>): void;
  hangUp(): void;
}

function acceptRealtime({ final, opens = true }: { final?: string; opens?: boolean } = {}): RealtimeSession {
  const session: RealtimeSession = {
    protocols: undefined,
    received: [],
    closed: false,
    say: () => {},
    hangUp: () => {},
  };
  server.use(
    realtime.addEventListener('connection', ({ client, info }) => {
      session.protocols = info.protocols;
      session.say = event => client.send(JSON.stringify(event));
      session.hangUp = () => client.close(1011, 'internal error');
      client.addEventListener('message', event => {
        const message = JSON.parse(String(event.data));
        session.received.push(message);
        if (message.type === 'input_audio.end' && final !== undefined) {
          client.send(JSON.stringify({ type: 'transcription.done', text: final }));
        }
      });
      client.addEventListener('close', () => {
        session.closed = true;
      });
      if (opens) client.send(JSON.stringify({ type: 'session.created', session: {} }));
    }),
  );
  return session;
}

describe('Composer live dictation', () => {
  beforeEach(() => {
    contexts.length = 0;
    nodes.length = 0;
    vi.stubGlobal('MediaRecorder', class {});
    vi.stubGlobal('AudioContext', FakeAudioContext);
    vi.stubGlobal('AudioWorkletNode', FakeAudioWorkletNode);
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => 'blob:capture-worklet' });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => {} });
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
    getUserMedia.mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] });
    stubVoiceSettings({ provider: 'mistral', model: 'voxtral-mini-latest' });
    answerLiveSession(() => HttpResponse.json(liveMode));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'mediaDevices');
    Reflect.deleteProperty(URL, 'createObjectURL');
    Reflect.deleteProperty(URL, 'revokeObjectURL');
    stopTrack.mockReset();
    getUserMedia.mockReset();
  });

  it('shows your words in the draft as you speak and keeps the final transcript', async () => {
    const uploads = acceptTranscribe(() => HttpResponse.json({ text: 'unused' }));
    const mistral = acceptRealtime({ final: 'and add a test for it.' });
    const user = userEvent.setup();
    const message = await composerReady();

    await user.type(message, 'fix the login bug');
    await user.click(screen.getByRole('button', { name: 'Dictate' }));
    const recording = await screen.findByRole('button', { name: 'Dictate', pressed: true });
    await speak(100);

    await waitFor(() => expect(mistral.received.map(event => event.type)).toContain('input_audio.append'));
    mistral.say({ type: 'transcription.text.delta', text: ' and add' });
    await waitFor(() => expect(message).toHaveValue('fix the login bug and add'));
    mistral.say({ type: 'transcription.text.delta', text: ' a test for it' });
    await waitFor(() => expect(message).toHaveValue('fix the login bug and add a test for it'));

    await user.click(recording);

    await waitFor(() => expect(message).toHaveValue('fix the login bug and add a test for it.'));
    await waitFor(() => expect(mistral.closed).toBe(true));
    expect(mistral.protocols).toEqual(['realtime', 'rt_test_token']);
    expect(mistral.received[0]).toEqual({
      type: 'session.update',
      session: { audio_format: { encoding: 'pcm_s16le', sample_rate: 16_000 } },
    });
    expect(mistral.received.at(-1)).toEqual({ type: 'input_audio.end' });
    const audio = mistral.received.find(event => event.type === 'input_audio.append')?.audio;
    expect(Buffer.from(String(audio), 'base64')).toHaveLength(1600 * 2);
    expect(stopTrack).toHaveBeenCalled();
    expect(contexts[0]?.state).toBe('closed');
    expect(uploads).toEqual([]);
    expect(screen.getByRole('button', { name: 'Dictate' })).toBeEnabled();
  });

  it('holds the message until dictation finishes, so the whole sentence goes out together', async () => {
    const mistral = acceptRealtime({ final: 'fix the login bug and add a test.' });
    const user = userEvent.setup();
    const message = await composerReady();

    await user.click(screen.getByRole('button', { name: 'Dictate' }));
    const recording = await screen.findByRole('button', { name: 'Dictate', pressed: true });
    await speak(100);
    await waitFor(() => expect(mistral.received.map(event => event.type)).toContain('input_audio.append'));
    mistral.say({ type: 'transcription.text.delta', text: 'fix the login bug' });
    await waitFor(() => expect(message).toHaveValue('fix the login bug'));

    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    await user.click(message);
    await user.keyboard('{Enter}');
    expect(message).toHaveValue('fix the login bug');

    await user.click(recording);

    await waitFor(() => expect(message).toHaveValue('fix the login bug and add a test.'));
    expect(screen.getByRole('button', { name: 'Send message' })).toBeEnabled();
  });

  it('keeps what was heard and explains when the live connection drops mid-sentence', async () => {
    const mistral = acceptRealtime();
    const user = userEvent.setup();
    const message = await composerReady();

    await user.click(screen.getByRole('button', { name: 'Dictate' }));
    await screen.findByRole('button', { name: 'Dictate', pressed: true });
    await speak(100);
    await waitFor(() => expect(mistral.received.map(event => event.type)).toContain('input_audio.append'));
    mistral.say({ type: 'transcription.text.delta', text: 'Refactor the' });
    await waitFor(() => expect(message).toHaveValue('Refactor the'));

    mistral.hangUp();

    expect(await screen.findByText('Live transcription stopped unexpectedly. Try again.')).toBeVisible();
    expect(message).toHaveValue('Refactor the');
    expect(stopTrack).toHaveBeenCalled();
    expect(contexts[0]?.state).toBe('closed');
    expect(screen.getByRole('button', { name: 'Dictate' })).toBeEnabled();
  });

  it('explains a Mistral error in its own words, keeps what was heard, and releases the microphone', async () => {
    const mistral = acceptRealtime();
    const user = userEvent.setup();
    const message = await composerReady();

    await user.click(screen.getByRole('button', { name: 'Dictate' }));
    await screen.findByRole('button', { name: 'Dictate', pressed: true });
    await speak(100);
    await waitFor(() => expect(mistral.received.map(event => event.type)).toContain('input_audio.append'));
    mistral.say({ type: 'transcription.text.delta', text: 'Refactor the' });
    await waitFor(() => expect(message).toHaveValue('Refactor the'));
    mistral.say({ type: 'error', error: { message: 'Invalid audio format', code: 'invalid_request' } });

    expect(await screen.findByText('Live transcription failed. Try again.')).toBeVisible();
    expect(screen.queryByText(/Invalid audio format/)).toBeNull();
    expect(message).toHaveValue('Refactor the');
    await waitFor(() => expect(mistral.closed).toBe(true));
    expect(stopTrack).toHaveBeenCalled();
  });

  it('gives up and releases the microphone when Mistral never opens the session', async () => {
    const mistral = acceptRealtime({ opens: false });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await composerReady();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    await user.click(screen.getByRole('button', { name: 'Dictate' }));
    await screen.findByRole('button', { name: 'Dictate', pressed: true });
    await vi.advanceTimersByTimeAsync(10_000);

    expect(await screen.findByText('Live transcription could not connect. Try again.')).toBeVisible();
    expect(stopTrack).toHaveBeenCalled();
    expect(contexts[0]?.state).toBe('closed');
    await waitFor(() => expect(mistral.closed).toBe(true));
    expect(mistral.received).toEqual([]);
  });

  it('releases the microphone and hangs up when the composer goes away mid-dictation', async () => {
    const mistral = acceptRealtime();
    const user = userEvent.setup();
    stubPreparingSession({ materialized: true });
    const view = renderThread();
    const dictate = await screen.findByRole('button', { name: 'Dictate' });
    await waitFor(() => expect(dictate).toBeEnabled());

    await user.click(dictate);
    await screen.findByRole('button', { name: 'Dictate', pressed: true });
    await waitFor(() => expect(mistral.received.map(event => event.type)).toContain('session.update'));
    view.unmount();

    expect(stopTrack).toHaveBeenCalled();
    expect(contexts[0]?.state).toBe('closed');
    await waitFor(() => expect(mistral.closed).toBe(true));
  });
});
