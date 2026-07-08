/**
 * Cloud STT engine.
 *
 * Records microphone audio to a WAV via `MicRecording`, then transcribes it
 * through a cloud provider (`transcribe.ts`, provider-agnostic). While
 * recording, it periodically re-transcribes the audio-so-far and emits that as
 * a partial, which keeps the live text stable and self-correcting (the provider
 * re-derives the whole utterance each tick). On stop it emits the final, most
 * accurate transcript.
 *
 * This preserves the original chunked-live behavior for non-macOS / cloud users
 * while keeping the controller engine-agnostic.
 */

import type { AuthStorage } from '../../../auth/storage.js';
import { detectRecorder, MicRecording } from '../mic-capture.js';
import type { RecorderInfo } from '../mic-capture.js';
import { createTranscriber, hasProviderCredential } from '../transcribe.js';
import type { ReusableTranscriber } from '../transcribe.js';
import type { STTEngine, STTSession, STTSessionCallbacks } from './types.js';

/** How often to re-transcribe the audio-so-far while recording (ms). */
const LIVE_TRANSCRIBE_INTERVAL_MS = 1200;
/**
 * Delay before the *first* live tick. Kept short so the opening words appear
 * quickly: the recorder needs a moment to spawn and write a usable WAV, and
 * until then `snapshot()` returns null and the tick is a cheap no-op that
 * re-arms at this same short cadence — so the first partial fires as soon as
 * there's audio rather than waiting a full interval.
 */
const LIVE_TRANSCRIBE_FIRST_MS = 250;

export interface CloudEngineOptions {
  provider: string;
  model?: string;
  authStorage?: AuthStorage;
}

function missingRecorderMessage(): string {
  if (process.platform === 'darwin') {
    return 'Voice input needs a recorder. Install sox (`brew install sox`) or ffmpeg, then run /voice again.';
  }
  return 'Voice input needs a recorder. Install one of pipewire-utils (pw-record), pulseaudio-utils (parecord), alsa-utils (arecord), or sox, then run /voice again.';
}

class CloudSession implements STTSession {
  private recording: MicRecording | null;
  private liveTimer: ReturnType<typeof setTimeout> | null = null;
  private liveInFlight = false;
  private stopped = false;
  private lastPartial = '';
  private sawAudio = false;
  private readonly transcriber: ReusableTranscriber;

  constructor(
    recorder: RecorderInfo,
    private readonly options: CloudEngineOptions,
    private readonly callbacks: STTSessionCallbacks,
  ) {
    // Build the provider client once and reuse it across ticks so its HTTP
    // connection stays warm (keep-alive). This removes the DNS + TLS handshake
    // cost from every request — the main reason the first dictation streamed in
    // slowly while later ones felt instant.
    this.transcriber = createTranscriber({
      provider: this.options.provider,
      model: this.options.model,
      authStorage: this.options.authStorage,
    });
    try {
      this.recording = new MicRecording(recorder);
    } catch {
      this.recording = null;
      // Surface asynchronously so `start()` can return a session handle first.
      queueMicrotask(() => this.callbacks.onError(new Error('Could not start the microphone recorder.')));
      return;
    }
    this.startLiveTranscription();
  }

  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    this.stopLiveTranscription();
    const recording = this.recording;
    this.recording = null;
    if (!recording) return;

    let audio: Buffer | null = null;
    try {
      audio = await recording.stop();
    } catch (err) {
      this.callbacks.onError(err instanceof Error ? err : new Error('Could not stop the microphone recorder.'));
      return;
    }
    if (!audio) {
      this.callbacks.onFinal('');
      return;
    }

    try {
      const text = await this.transcriber.transcribe(audio);
      this.callbacks.onFinal(text);
    } catch (err) {
      this.callbacks.onError(err instanceof Error ? err : new Error('Transcription failed.'));
    }
  }

  cancel(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.stopLiveTranscription();
    if (this.recording) {
      this.recording.cancel();
      this.recording = null;
    }
  }

  /**
   * Schedule live ticks as a self-rescheduling timeout chain rather than a
   * setInterval. This keeps `liveTimer` a single timeout handle (so cancellation
   * is unambiguous) and guarantees ticks never overlap: the next tick is only
   * armed after the current one settles, even when a transcription request runs
   * longer than the interval.
   */
  private startLiveTranscription(): void {
    const schedule = (delay: number) => {
      if (this.stopped) return;
      this.liveTimer = setTimeout(async () => {
        await this.runLiveTick();
        // Until the recorder has produced enough audio to transcribe, keep
        // polling at the short first-tick cadence so the opening partial fires
        // the instant audio is available. Once we've seen audio, fall back to
        // the normal interval to avoid hammering the provider.
        schedule(this.sawAudio ? LIVE_TRANSCRIBE_INTERVAL_MS : LIVE_TRANSCRIBE_FIRST_MS);
      }, delay);
    };
    schedule(LIVE_TRANSCRIBE_FIRST_MS);
  }

  private stopLiveTranscription(): void {
    if (this.liveTimer) {
      clearTimeout(this.liveTimer);
      this.liveTimer = null;
    }
  }

  private async runLiveTick(): Promise<void> {
    if (this.liveInFlight || this.stopped || !this.recording) return;
    const snapshot = this.recording.snapshot();
    if (!snapshot) return;
    this.sawAudio = true;

    this.liveInFlight = true;
    try {
      const text = await this.transcriber.transcribe(snapshot);
      if (!this.stopped && text && text !== this.lastPartial) {
        this.lastPartial = text;
        this.callbacks.onPartial(text);
      }
    } catch (err) {
      // Transient mid-recording failures are expected (e.g. a snapshot taken
      // before the recorder flushed a full frame). Log for diagnosability;
      // stop() still surfaces a persistent failure to the user.
      if (process.env.MASTRACODE_VOICE_DEBUG) {
        console.error('[voice] live transcription tick failed:', err);
      }
    } finally {
      this.liveInFlight = false;
    }
  }
}

export class CloudSTTEngine implements STTEngine {
  readonly kind = 'cloud' as const;

  constructor(private readonly options: CloudEngineOptions) {}

  checkReady(): string | null {
    if (!detectRecorder()) return missingRecorderMessage();
    if (!hasProviderCredential(this.options.provider, this.options.authStorage)) {
      const env =
        this.options.provider === 'openai' ? 'OPENAI_API_KEY' : `${this.options.provider.toUpperCase()}_API_KEY`;
      return `Voice input needs a ${this.options.provider} API key. Set ${env} or add one with /api-keys.`;
    }
    return null;
  }

  start(callbacks: STTSessionCallbacks): STTSession {
    const recorder = detectRecorder();
    if (!recorder) {
      queueMicrotask(() => callbacks.onError(new Error(missingRecorderMessage())));
      return inertSession();
    }
    try {
      return new CloudSession(recorder, this.options, callbacks);
    } catch (err) {
      // createTranscriber throws VoiceCredentialError when no key is available;
      // checkReady() normally catches this first, but surface it cleanly here too.
      queueMicrotask(() => callbacks.onError(err instanceof Error ? err : new Error('Transcription unavailable.')));
      return inertSession();
    }
  }
}

function inertSession(): STTSession {
  return {
    async stop() {},
    cancel() {},
  };
}
