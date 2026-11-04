import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { VoiceSettingsResponse } from '../../../../../api/types';
import { FACTORY_ID, renderThread, stubPreparingSession } from './composer-session-test-fixture';

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

function acceptTranscribe(reply: () => Response): unknown[] {
  const bodies: unknown[] = [];
  server.use(
    http.post(`${TEST_BASE_URL}/web/voice/transcribe`, async ({ request }) => {
      bodies.push(await request.json());
      return reply();
    }),
  );
  return bodies;
}

function stubVoiceSettings(effective: VoiceSettingsResponse['effective']) {
  const response: VoiceSettingsResponse = {
    scope: 'user',
    selected: null,
    canEdit: true,
    effective,
    models: [],
    keys: [],
  };
  server.use(http.get(`${TEST_BASE_URL}/web/voice/settings`, () => HttpResponse.json(response)));
}

async function composerReady() {
  stubPreparingSession({ materialized: true });
  renderThread();
  const message = await screen.findByRole('textbox', { name: 'Message' });
  await waitFor(() => expect(message).toBeEnabled());
  await waitFor(() => expect(screen.getByRole('button', { name: 'Dictate' })).toBeEnabled());
  return message;
}

describe('Composer voice dictation', () => {
  beforeEach(() => {
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
    getUserMedia.mockResolvedValue(micStream());
    stubVoiceSettings({ provider: 'openai', model: 'whisper-1' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'mediaDevices');
    stopTrack.mockReset();
    getUserMedia.mockReset();
  });

  it('records, transcribes, and appends the transcript to the draft', async () => {
    const bodies = acceptTranscribe(() => HttpResponse.json({ text: 'and add a test for it' }));
    const user = userEvent.setup();
    const message = await composerReady();

    await user.type(message, 'fix the login bug');
    await user.click(screen.getByRole('button', { name: 'Dictate' }));
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });

    await user.click(await screen.findByRole('button', { name: 'Stop dictation' }));

    await waitFor(() => expect(message).toHaveValue('fix the login bug and add a test for it'));
    expect(bodies).toEqual([{ audio: btoa('opus'), mimeType: 'audio/webm;codecs=opus', factoryId: FACTORY_ID }]);
    expect(stopTrack).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Dictate' })).toBeEnabled();
  });

  it('explains a blocked microphone without calling the server', async () => {
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
    expect(screen.queryByRole('button', { name: 'Stop dictation' })).not.toBeInTheDocument();
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
    const waiting = await screen.findByRole('button', { name: 'Waiting for microphone…' });
    expect(waiting).toBeDisabled();
    await user.click(waiting);
    grantMic(micStream());
    await user.click(await screen.findByRole('button', { name: 'Stop dictation' }));

    expect(getUserMedia).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Dictate' })).toBeEnabled());
    expect(stopTrack).toHaveBeenCalledTimes(1);
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
    await user.click(await screen.findByRole('button', { name: 'Stop dictation' }));

    expect(await screen.findByText(/Voice input needs an API key/)).toBeVisible();
    expect(message).toHaveValue('');
  });
});
