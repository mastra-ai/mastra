import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '../../../../../../e2e/ui/msw-server';
import { TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import { renderThread, stubPreparingSession } from './composer-session-test-fixture';

/** Browser recorder stand-in: emits one chunk of the clip when stopped, like a real MediaRecorder. */
class FakeMediaRecorder {
  state: 'inactive' | 'recording' = 'inactive';
  mimeType = 'audio/webm;codecs=opus';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(readonly stream: MediaStream) {}
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

function micStream(): MediaStream {
  return { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;
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

async function composerReady() {
  stubPreparingSession({ materialized: true });
  renderThread();
  const message = await screen.findByRole('textbox', { name: 'Message' });
  await waitFor(() => expect(message).toBeEnabled());
  return message;
}

describe('Composer voice dictation', () => {
  beforeEach(() => {
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
    getUserMedia.mockResolvedValue(micStream());
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
    expect(bodies).toEqual([{ audio: btoa('opus'), mimeType: 'audio/webm;codecs=opus' }]);
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

  it('shows the server error when no transcription key is configured', async () => {
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
