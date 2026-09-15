/**
 * Speech-to-text engine abstraction.
 *
 * An `STTEngine` owns one way of turning microphone audio into text. The voice
 * controller stays engine-agnostic: it asks an engine whether it is ready, then
 * opens a streaming `STTSession` that emits partial transcripts as the user
 * speaks and a final transcript when they stop.
 *
 * Two implementations exist:
 * - `macos-native`: an on-device `SFSpeechRecognizer` process. Truly realtime —
 *   it streams genuine interim results with no network and no per-tick cost.
 * - `cloud`: records to a WAV and transcribes through a cloud provider, polling
 *   the audio-so-far for partials (provider-agnostic via `transcribe.ts`).
 */

export type STTEngineKind = 'macos-native' | 'cloud';

export interface STTSessionCallbacks {
  /**
   * Best transcript of everything heard so far. Each call supersedes the prior
   * one (replace, not append), so the input box shows live dictation.
   */
  onPartial(text: string): void;
  /** Final, most-accurate transcript for the utterance. */
  onFinal(text: string): void;
  /** A fatal error for this session (capture failure, auth, permission). */
  onError(error: Error): void;
}

export interface STTSession {
  /** Stop capture and resolve once the final transcript has been emitted. */
  stop(): Promise<void>;
  /** Abort capture immediately without emitting a final transcript. */
  cancel(): void;
}

/**
 * Whether a required OS permission is granted, will prompt on first use, or is
 * actively blocked and needs the user to change a setting.
 */
export type PermissionState = 'ok' | 'will-prompt' | 'blocked' | 'unsupported';

/**
 * Actionable guidance for getting an engine ready. Lets the TUI walk the user
 * through fixing permissions (e.g. open the exact Settings pane) instead of just
 * printing a message and assuming they know what to do.
 */
export interface PermissionGuidance {
  state: PermissionState;
  /** Short, user-facing summary of what's wrong or what will happen. */
  summary: string;
  /** Ordered, plain-language steps the user can follow. */
  steps?: string[];
  /**
   * A URL that opens the relevant settings UI (e.g. a macOS
   * `x-apple.systempreferences:` deep link). When present the TUI can offer to
   * open it for the user.
   */
  settingsUrl?: string;
  /** Label for the action that opens `settingsUrl` (e.g. "Open System Settings"). */
  actionLabel?: string;
}

export interface STTEngine {
  readonly kind: STTEngineKind;
  /**
   * Begin a streaming recognition session. Implementations should start capture
   * synchronously (so the caller can flip into a "recording" state) and deliver
   * results through the callbacks.
   */
  start(callbacks: STTSessionCallbacks): STTSession;
  /**
   * Fast, synchronous preflight. Returns `null` when the engine is plausibly
   * ready, or a user-facing message explaining what is missing (recorder, API
   * key, unsupported platform). Kept sync so toggling voice on stays instant.
   */
  checkReady(): string | null;
  /**
   * Optional deeper preflight that may do async work (e.g. compiling the native
   * recognizer). Returns `null` when verified ready, or a user-facing message.
   * Used by `/voice status` so failures surface before the user dictates.
   */
  verify?(): Promise<string | null>;
  /**
   * Optional structured permission check. Unlike `verify()` (which returns a
   * flat string), this returns actionable guidance — including a deep link to
   * the relevant settings pane — so the TUI can guide the user through granting
   * access rather than assuming they know how.
   */
  permissions?(): Promise<PermissionGuidance>;
}
