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
import type { VoiceSettings } from '../../onboarding/settings.js';
import { createSTTEngine } from './engines/index.js';
import type { PermissionGuidance, STTEngine, STTSession } from './engines/types.js';

export interface VoiceControllerOptions {
  authStorage?: AuthStorage;
  /** Voice configuration (engine/provider/model). */
  settings: VoiceSettings;
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

export class VoiceController {
  private enabled = false;
  private state: VoiceState = 'idle';
  private session: STTSession | null = null;
  private engine: STTEngine;
  private settings: VoiceSettings;
  // Whether at least one live partial transcript actually streamed during the
  // current recording. Lets stop() distinguish "nothing was heard" from "live
  // text already surfaced", so the capture warning only fires when truly empty.
  private liveTranscriptEmitted = false;
  private readonly options: VoiceControllerOptions;

  constructor(options: VoiceControllerOptions) {
    this.options = options;
    this.settings = options.settings;
    this.engine = createSTTEngine(this.settings, options.authStorage);
  }

  /**
   * Swap the active engine/provider/model from updated settings. If voice is
   * currently enabled it is re-validated against the new engine.
   */
  reconfigure(settings: VoiceSettings): void {
    this.cancelRecording();
    this.settings = settings;
    this.engine = createSTTEngine(settings, this.options.authStorage);
    if (this.enabled) {
      const problem = this.engine.checkReady();
      if (problem) {
        this.enabled = false;
        this.options.showError(problem);
      }
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Deeper readiness check that may do async work (e.g. compiling the native
   * recognizer). Returns `null` when ready or a user-facing problem message.
   * Falls back to the synchronous check when the engine has no async verify.
   */
  async verifyReady(): Promise<string | null> {
    if (this.engine.verify) return this.engine.verify();
    return this.engine.checkReady();
  }

  /**
   * Structured, actionable permission guidance for the active engine (e.g. how
   * to grant macOS Microphone/Speech access). Returns `null` for engines that
   * don't expose it (cloud), so callers can skip the guided flow.
   */
  async permissionGuidance(): Promise<PermissionGuidance | null> {
    if (this.engine.permissions) return this.engine.permissions();
    return null;
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
    const problem = this.engine.checkReady();
    if (problem) {
      this.options.showError(problem);
      return false;
    }
    this.enabled = true;
    this.options.showInfo('Voice input on. Hold space to talk; release to transcribe. /voice to turn off.');
    return true;
  }

  /**
   * Restore the persisted enabled state at startup without emitting the
   * interactive "voice input on" message or surfacing errors. Silently stays
   * disabled if the active engine is not ready.
   */
  restoreEnabled(): void {
    if (this.enabled) return;
    if (this.engine.checkReady()) return;
    this.enabled = true;
  }

  disable(): void {
    this.cancelRecording();
    this.enabled = false;
    this.options.showInfo('Voice input off.');
  }

  /**
   * Begin a streaming recognition session. No-op if disabled or already active.
   * Partial results stream into the input via onPartialTranscript; the final
   * result replaces the live text (live mode) or streams in word-by-word.
   */
  startRecording(): void {
    if (!this.enabled || this.state !== 'idle') return;
    const live = !!this.options.onPartialTranscript;
    this.liveTranscriptEmitted = false;
    this.state = 'recording';
    this.options.onListeningChange?.(true);

    this.session = this.engine.start({
      onPartial: text => {
        if (this.state !== 'recording' || !text) return;
        this.liveTranscriptEmitted = true;
        this.options.onPartialTranscript?.(text);
      },
      onFinal: text => {
        if (live) {
          // Replace the live partial with the final, most accurate transcript.
          if (text) this.options.onPartialTranscript!(text);
          else if (!this.liveTranscriptEmitted) this.options.showInfo('No speech detected.');
        } else if (text) {
          void this.streamTranscript(text);
        } else {
          this.options.showInfo('No speech detected.');
        }
      },
      onError: err => {
        void this.reportSessionError(err);
      },
    });
  }

  /**
   * Stop the session and let the engine emit its final transcript.
   */
  async stopRecording(): Promise<void> {
    if (this.state !== 'recording') return;
    const session = this.session;
    this.session = null;
    this.state = 'transcribing';
    this.options.onListeningChange?.(false);
    try {
      await session?.stop();
    } finally {
      this.state = 'idle';
    }
  }

  /**
   * Abort any in-progress session without transcribing.
   */
  cancelRecording(): void {
    if (this.session) {
      this.session.cancel();
      this.session = null;
    }
    if (this.state !== 'idle') {
      this.state = 'idle';
      this.options.onListeningChange?.(false);
    }
  }

  /**
   * Surface a session error. If the active engine can explain a permission
   * problem (e.g. macOS access is blocked), append the concrete fix steps so the
   * user knows exactly what to do instead of seeing a bare failure.
   */
  private async reportSessionError(err: Error): Promise<void> {
    const base = err.message || 'Transcription failed.';
    try {
      const guidance = await this.engine.permissions?.();
      // Only dress the error with fix steps when access is actually blocked or
      // unavailable. A `will-prompt` (not-yet-determined) state is NOT the reason
      // a session failed — surfacing "macOS will prompt next time" in red after a
      // crash is confusing, so we let the real error message through instead.
      if (guidance && (guidance.state === 'blocked' || guidance.state === 'unsupported') && guidance.steps?.length) {
        const steps = guidance.steps.map((step, i) => `  ${i + 1}. ${step}`).join('\n');
        this.options.showError(`${guidance.summary}\n${steps}`);
        return;
      }
    } catch {
      // Fall through to the plain error if guidance can't be produced.
    }
    this.options.showError(base);
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
