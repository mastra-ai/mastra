/**
 * Push-to-talk voice input controller for the TUI.
 *
 * Owns the enabled/recording state and ties microphone capture to
 * transcription. The editor drives this controller from its key dispatch:
 * it calls startRecording() when a held space begins push-to-talk, and
 * stopRecording() when the space key is released (detected as an idle gap
 * after the last repeated space).
 *
 * Transcribed text is delivered through the onTranscript callback so the
 * editor can insert it at the cursor.
 */

import type { AuthStorage } from '../../auth/storage.js';
import type { RecorderInfo } from './mic-capture.js';
import { detectRecorder, MicRecording } from './mic-capture.js';
import { resolveOpenAIApiKey, transcribeAudio, VoiceCredentialError } from './transcribe.js';

/** How often to re-transcribe the audio-so-far while recording (ms). */
const LIVE_TRANSCRIBE_INTERVAL_MS = 1200;

/**
 * Delay before the first partial transcription after recording starts. Kept
 * short so the first words appear quickly instead of waiting a full interval.
 */
const LIVE_TRANSCRIBE_FIRST_MS = 600;

export interface VoiceControllerOptions {
  authStorage?: AuthStorage;
  /** Called with transcribed text to insert at the cursor. */
  onTranscript: (text: string) => void;
  /**
   * Called repeatedly during recording with the best transcript of the audio
   * captured so far. Each call supersedes the previous one (replace, not
   * append), so the input shows live dictation as the user keeps speaking.
   */
  onPartialTranscript?: (text: string) => void;
  /** Show a transient informational message. */
  showInfo: (message: string) => void;
  /** Show a transient error message. */
  showError: (message: string) => void;
  /**
   * Called when push-to-talk recording starts (true) and ends (false) so the
   * editor can drive a "listening" cursor animation.
   */
  onListeningChange?: (listening: boolean) => void;
}

export type VoiceState = 'idle' | 'recording' | 'transcribing';

function missingRecorderMessage(): string {
  if (process.platform === 'darwin') {
    return 'Voice input needs a recorder. Install sox (`brew install sox`) or ffmpeg, then run /voice again.';
  }
  // Linux: native recorders usually ship with the desktop audio stack.
  return 'Voice input needs a recorder. Install one of pipewire-utils (pw-record), pulseaudio-utils (parecord), alsa-utils (arecord), or sox, then run /voice again.';
}

export class VoiceController {
  private enabled = false;
  private state: VoiceState = 'idle';
  private recording: MicRecording | null = null;
  private recorder: RecorderInfo | null = null;
  private liveTimer: ReturnType<typeof setTimeout> | null = null;
  private liveInFlight = false;
  private readonly options: VoiceControllerOptions;

  constructor(options: VoiceControllerOptions) {
    this.options = options;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getState(): VoiceState {
    return this.state;
  }

  isRecording(): boolean {
    return this.state === 'recording';
  }

  /**
   * Toggle voice input on/off. Returns the new enabled state.
   * Reports problems (missing recorder/credentials) via showError and stays
   * disabled when prerequisites are missing.
   */
  toggle(): boolean {
    if (this.enabled) {
      this.disable();
      return false;
    }
    return this.enable();
  }

  enable(): boolean {
    const recorder = detectRecorder();
    if (!recorder) {
      this.options.showError(missingRecorderMessage());
      return false;
    }
    if (!resolveOpenAIApiKey(this.options.authStorage)) {
      this.options.showError(new VoiceCredentialError().message);
      return false;
    }
    this.recorder = recorder;
    this.enabled = true;
    this.options.showInfo('Voice input on. Hold space to talk; release to transcribe. /voice to turn off.');
    return true;
  }

  /**
   * Restore the persisted enabled state at startup without emitting the
   * interactive "voice input on" message or surfacing errors. Silently stays
   * disabled if a recorder or credentials are unavailable.
   */
  restoreEnabled(): void {
    if (this.enabled) return;
    const recorder = detectRecorder();
    if (!recorder) return;
    if (!resolveOpenAIApiKey(this.options.authStorage)) return;
    this.recorder = recorder;
    this.enabled = true;
  }

  disable(): void {
    this.cancelRecording();
    this.enabled = false;
    this.recorder = null;
    this.options.showInfo('Voice input off.');
  }

  /**
   * Begin recording from the microphone. No-op if disabled or already active.
   */
  startRecording(): void {
    if (!this.enabled || this.state !== 'idle' || !this.recorder) return;
    try {
      this.recording = new MicRecording(this.recorder);
      this.state = 'recording';
      this.options.onListeningChange?.(true);
      this.startLiveTranscription();
    } catch {
      this.recording = null;
      this.state = 'idle';
      this.options.showError('Could not start the microphone recorder.');
    }
  }

  /**
   * Stop recording and transcribe. Inserts the transcript via onTranscript.
   */
  async stopRecording(): Promise<void> {
    if (this.state !== 'recording' || !this.recording) return;
    const recording = this.recording;
    this.recording = null;
    this.state = 'transcribing';
    this.stopLiveTranscription();
    this.options.onListeningChange?.(false);

    const live = !!this.options.onPartialTranscript;

    let audio: Buffer | null = null;
    try {
      audio = await recording.stop();
    } catch {
      audio = null;
    }

    if (!audio) {
      this.state = 'idle';
      // In live mode the partial transcript already shows what was heard; only
      // warn when nothing streamed in at all.
      if (!live) this.options.showError('No audio captured.');
      return;
    }

    try {
      const text = await transcribeAudio(audio, { authStorage: this.options.authStorage });
      if (live) {
        // Replace the live partial with the final, most accurate transcript.
        this.options.onPartialTranscript!(text);
      } else if (text) {
        await this.streamTranscript(text);
      } else {
        this.options.showInfo('No speech detected.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transcription failed.';
      this.options.showError(message);
    } finally {
      this.state = 'idle';
    }
  }

  /**
   * Abort any in-progress recording without transcribing.
   */
  cancelRecording(): void {
    this.stopLiveTranscription();
    if (this.recording) {
      this.recording.cancel();
      this.recording = null;
    }
    if (this.state === 'recording') {
      this.state = 'idle';
      this.options.onListeningChange?.(false);
    }
  }

  /**
   * While recording, periodically transcribe the audio captured so far and push
   * it through onPartialTranscript so the input shows live dictation. Each tick
   * transcribes the full audio-so-far, which keeps the text stable and
   * self-correcting (Whisper re-derives the whole utterance, no word-boundary
   * artifacts). No-op when onPartialTranscript is not provided.
   */
  private startLiveTranscription(): void {
    if (!this.options.onPartialTranscript) return;
    // Fire an early first tick so the opening words appear quickly, then settle
    // into the steady cadence.
    this.liveTimer = setTimeout(() => {
      void this.runLiveTick();
      if (this.state !== 'recording') return;
      this.liveTimer = setInterval(() => {
        void this.runLiveTick();
      }, LIVE_TRANSCRIBE_INTERVAL_MS);
    }, LIVE_TRANSCRIBE_FIRST_MS);
  }

  private stopLiveTranscription(): void {
    if (this.liveTimer) {
      // liveTimer may be the initial setTimeout handle or the steady
      // setInterval handle; clearing both covers either phase.
      clearTimeout(this.liveTimer);
      clearInterval(this.liveTimer);
      this.liveTimer = null;
    }
  }

  private async runLiveTick(): Promise<void> {
    // Skip if a previous tick's transcription is still running so we don't
    // queue up overlapping requests on slow networks.
    if (this.liveInFlight || this.state !== 'recording' || !this.recording) return;
    const snapshot = this.recording.snapshot();
    if (!snapshot) return;

    this.liveInFlight = true;
    try {
      const text = await transcribeAudio(snapshot, { authStorage: this.options.authStorage });
      // Only apply if we're still recording — a stop() may have raced us.
      if (this.state === 'recording' && text) {
        this.options.onPartialTranscript?.(text);
      }
    } catch {
      // Ignore transient mid-recording transcription errors; the final
      // transcription on stop() will surface any persistent failure.
    } finally {
      this.liveInFlight = false;
    }
  }

  /**
   * Feed the transcript into the editor incrementally so it visibly streams in
   * word-by-word rather than appearing all at once. Each chunk keeps its
   * trailing whitespace so word spacing is preserved.
   */
  private async streamTranscript(text: string): Promise<void> {
    const chunks = text.match(/\S+\s*/g);
    if (!chunks) {
      this.options.onTranscript(text);
      return;
    }
    for (const chunk of chunks) {
      this.options.onTranscript(chunk);
      await new Promise(resolve => setTimeout(resolve, 30));
    }
  }
}
