import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LiveSessionResponse } from '../../../../../api/types';
import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import { FACTORY_ID, renderThread, stubPreparingSession } from './composer-session-test-fixture';
import { acceptTranscribe, answerLiveSession, composerReady, stubVoiceSettings } from './voice-dictation-test-fixture';

/** The slice of a mic stream the recorder touches: stopping its tracks releases the microphone. */
interface FakeMicStream {
  getTracks(): Array<{ stop(): void }>;
}

/** Browser recorder stand-in: emits one chunk of the clip when stopped, like a real MediaRecorder. */
class FakeMediaRecorder {
  state: 'inactive' | 'recording' = 'inactive';
  mimeType = 'audio/webm;codecs=opus';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(readonly stream: FakeMicStream) {}
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['opus'], { type: this.mimeType }) });
    this.onstop?.();
  }
}

const stopTrack = vi.fn();
const getUserMedia = vi.fn();

function micStream(): FakeMicStream {
  return { getTracks: () => [{ stop: stopTrack }] };
}

const recordedClipMode: LiveSessionResponse = { mode: 'batch' };

describe('Composer voice dictation', () => {
  beforeEach(() => {
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
    getUserMedia.mockResolvedValue(micStream());
    stubVoiceSettings({ provider: 'openai', model: 'whisper-1' });
    answerLiveSession(() => HttpResponse.json(recordedClipMode));
  });

  afterEach(() => {
    delete window.MASTRA_PLATFORM_PROJECT_ID;
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'mediaDevices');
    stopTrack.mockReset();
    getUserMedia.mockReset();
  });

  it('records a clip, transcribes it, and appends the transcript to the draft when the provider has no live mode', async () => {
    const bodies = acceptTranscribe(() => HttpResponse.json({ text: 'and add a test for it' }));
    const user = userEvent.setup();
    const message = await composerReady();

    await user.type(message, 'fix the login bug');
    await user.click(screen.getByRole('button', { name: 'Dictate' }));
    const recording = await screen.findByRole('button', { name: 'Dictate', pressed: true });
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });

    await user.click(recording);

    await waitFor(() => expect(message).toHaveValue('fix the login bug and add a test for it'));
    expect(bodies).toEqual([{ factoryId: FACTORY_ID, contentType: 'audio/webm', clip: 'opus' }]);
    expect(stopTrack).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Dictate' })).toBeEnabled();
  });

  it('uses the preferred Gateway model through the existing microphone when access is enabled', async () => {
    window.MASTRA_PLATFORM_PROJECT_ID = 'project-1';
    stubVoiceSettings(null);
    const legacyBodies = acceptTranscribe(() => HttpResponse.json({ text: 'unused' }));
    const liveSession = vi.fn(() => HttpResponse.json(recordedClipMode));
    answerLiveSession(liveSession);
    const models = [{ id: 'openai/whisper' }, { id: 'mistral/voxtral' }];
    const transcriptions: string[] = [];
    server.use(
      http.get(`${TEST_BASE_URL}/api/system/gateway-audio/models`, () =>
        HttpResponse.json({ speech: [], transcription: models }),
      ),
      http.post(`${TEST_BASE_URL}/api/system/gateway-audio/transcriptions`, async ({ request }) => {
        transcriptions.push(await request.text());
        return HttpResponse.json({ text: 'Gateway dictation' });
      }),
    );
    const user = userEvent.setup();
    const message = await composerReady();
    const settings = await screen.findByRole('button', { name: 'Voice input settings' });
    expect(screen.queryByRole('radio', { name: 'Mastra Gateway: openai/whisper' })).not.toBeInTheDocument();
    await user.click(settings);
    expect(screen.getByRole('radio', { name: 'Mastra Gateway: openai/whisper' })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'Mastra Gateway: mistral/voxtral' }));
    await user.click(screen.getByRole('button', { name: 'Dictate' }));
    await user.click(await screen.findByRole('button', { name: 'Dictate', pressed: true }));

    await waitFor(() => expect(message).toHaveValue('Gateway dictation'));
    expect(transcriptions).toHaveLength(1);
    expect(transcriptions[0]).toContain('mistral/voxtral');
    expect(legacyBodies).toEqual([]);
    expect(liveSession).not.toHaveBeenCalled();
  });

  it('keeps the configured voice provider available when Gateway is enabled', async () => {
    window.MASTRA_PLATFORM_PROJECT_ID = 'project-1';
    server.use(
      http.get(`${TEST_BASE_URL}/api/system/gateway-audio/models`, () =>
        HttpResponse.json({ speech: [], transcription: [{ id: 'openai/whisper' }] }),
      ),
    );
    const legacyBodies = acceptTranscribe(() => HttpResponse.json({ text: 'Provider dictation' }));
    const user = userEvent.setup();
    const message = await composerReady();
    await user.click(await screen.findByRole('button', { name: 'Voice input settings' }));
    await user.click(screen.getByRole('radio', { name: 'Configured provider' }));

    await user.click(screen.getByRole('button', { name: 'Dictate' }));
    await user.click(await screen.findByRole('button', { name: 'Dictate', pressed: true }));

    await waitFor(() => expect(message).toHaveValue('Provider dictation'));
    expect(legacyBodies).toHaveLength(1);
  });

  it('does not show Gateway choices when the deployed user is denied access', async () => {
    window.MASTRA_PLATFORM_PROJECT_ID = 'project-1';
    const checked = vi.fn(() => new HttpResponse(null, { status: 403 }));
    server.use(http.get(`${TEST_BASE_URL}/api/system/gateway-audio/models`, checked));
    await composerReady();

    await waitFor(() => expect(checked).toHaveBeenCalledOnce());
    expect(screen.queryByRole('button', { name: 'Voice input settings' })).not.toBeInTheDocument();
  });

  it('explains a blocked microphone without sending a recording', async () => {
    getUserMedia.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    const bodies = acceptTranscribe(() => HttpResponse.json({ text: 'unused' }));
    const user = userEvent.setup();
    await composerReady();

    await user.click(screen.getByRole('button', { name: 'Dictate' }));

    expect(await screen.findByText(/Microphone access was blocked/)).toBeVisible();
    expect(bodies).toEqual([]);
  });

  it.each([
    ['NotFoundError', 'No microphone found. Connect one to use voice input.'],
    ['NotReadableError', 'Your microphone is busy in another app. Close it and try again.'],
    ['AbortError', 'Could not start the microphone. Try again.'],
  ])('tells you what to fix when the microphone fails with %s', async (name, message) => {
    getUserMedia.mockRejectedValue(new DOMException('mic failed', name));
    const user = userEvent.setup();
    await composerReady();

    await user.click(screen.getByRole('button', { name: 'Dictate' }));

    expect(await screen.findByText(message)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Dictate' })).toBeEnabled();
  });

  it('releases the microphone and explains when the browser cannot start recording', async () => {
    vi.stubGlobal(
      'MediaRecorder',
      class {
        constructor() {
          throw new DOMException('unsupported', 'NotSupportedError');
        }
      },
    );
    const bodies = acceptTranscribe(() => HttpResponse.json({ text: 'unused' }));
    const user = userEvent.setup();
    await composerReady();

    await user.click(screen.getByRole('button', { name: 'Dictate' }));

    expect(
      await screen.findByText('This browser could not start recording. Try again or use another browser.'),
    ).toBeVisible();
    expect(stopTrack).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Dictate', pressed: true })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dictate' })).toBeEnabled();
    expect(bodies).toEqual([]);
  });

  it('opens one microphone even when clicked again while the browser asks for permission', async () => {
    let grantMic: (stream: FakeMicStream) => void = () => {};
    getUserMedia.mockReturnValue(new Promise<FakeMicStream>(resolve => (grantMic = resolve)));
    acceptTranscribe(() => HttpResponse.json({ text: 'hello' }));
    const user = userEvent.setup();
    await composerReady();

    await user.click(screen.getByRole('button', { name: 'Dictate' }));
    const dictate = screen.getByRole('button', { name: 'Dictate' });
    await waitFor(() => expect(dictate).toBeDisabled());
    await user.click(dictate);
    grantMic(micStream());
    await user.click(await screen.findByRole('button', { name: 'Dictate', pressed: true }));

    expect(getUserMedia).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Dictate' })).toBeEnabled());
    expect(stopTrack).toHaveBeenCalledTimes(1);
  });

  it('releases the microphone when the composer goes away mid-recording', async () => {
    const bodies = acceptTranscribe(() => HttpResponse.json({ text: 'unused' }));
    const user = userEvent.setup();
    stubPreparingSession({ materialized: true });
    const view = renderThread();
    const dictate = await screen.findByRole('button', { name: 'Dictate' });
    await waitFor(() => expect(dictate).toBeEnabled());

    await user.click(dictate);
    await screen.findByRole('button', { name: 'Dictate', pressed: true });
    view.unmount();

    expect(stopTrack).toHaveBeenCalledTimes(1);
    expect(bodies).toEqual([]);
  });

  it('sends you to voice input settings instead of recording when no speech-to-text key is set up', async () => {
    stubVoiceSettings(null);
    const user = userEvent.setup();
    stubPreparingSession({ materialized: true });
    renderThread();

    await user.click(await screen.findByRole('button', { name: 'Set up voice input in settings' }));

    expect(getUserMedia).not.toHaveBeenCalled();
    expect(screen.getByTestId('location')).toHaveTextContent(`/factories/${FACTORY_ID}/settings/models#voice-input`);
  });

  it('shows the server error when transcription is refused', async () => {
    acceptTranscribe(() =>
      HttpResponse.json({ error: 'Voice input needs an API key for a speech-to-text provider.' }, { status: 400 }),
    );
    const user = userEvent.setup();
    const message = await composerReady();

    await user.click(screen.getByRole('button', { name: 'Dictate' }));
    await user.click(await screen.findByRole('button', { name: 'Dictate', pressed: true }));

    expect(await screen.findByText(/Voice input needs an API key/)).toBeVisible();
    expect(message).toHaveValue('');
  });

  it('asks you to wait instead of opening the microphone when you dictate too often', async () => {
    answerLiveSession(() => HttpResponse.json({ error: 'voice_rate_limited' }, { status: 429 }));
    const user = userEvent.setup();
    await composerReady();

    await user.click(screen.getByRole('button', { name: 'Dictate' }));

    expect(await screen.findByText('Too many voice requests. Wait a minute and try again.')).toBeVisible();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Dictate' })).toBeEnabled();
  });
});
