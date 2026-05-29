import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { ToolsInput, RequestContext } from '@internal/voice';
import { MastraVoice } from '@internal/voice';
import { WebSocket } from 'ws';
import type {
  InworldInputTranscription,
  InworldMemoryState,
  InworldProviderData,
  InworldResponseConfig,
  InworldSessionConfig,
  InworldTurnDetection,
  InworldVoiceEventMap,
  InworldVoiceProfile,
} from './types';
import { deepMerge, isReadableStream, transformTools } from './utils';

type EventCallback = (...args: any[]) => void;

type StreamWithId = PassThrough & { id: string };

type EventStore = Record<string, EventCallback[]>;

/**
 * Default voice. Inworld ships a curated voice catalog; the authoritative list
 * comes from `getSpeakers()`.
 */
const DEFAULT_VOICE = 'Sarah';

const DEFAULT_URL = 'wss://api.inworld.ai/api/v1/realtime/session';

/**
 * Default realtime model. Inworld routes via an LLM Router; any model ID it
 * exposes is accepted (e.g. `inworld/...`, `anthropic/...`, `openai/...`).
 */
const DEFAULT_MODEL = 'inworld/models/gemma-4-26b-a4b-it';

/**
 * Default turn-detection config. Semantic VAD is the conversational default —
 * it produces speech-started/speech-stopped events the server interprets in
 * context (rather than purely on energy thresholds) and lets the model
 * interrupt itself mid-response. Override per call via `session.audio.input.turn_detection`,
 * or disable entirely by passing `null`.
 */
const DEFAULT_TURN_DETECTION: InworldTurnDetection = {
  type: 'semantic_vad',
  eagerness: 'medium',
  create_response: true,
  interrupt_response: true,
};

/**
 * Default user-side transcription. The realtime server transcribes incoming
 * audio with its own engine by default; an Inworld voice provider should pick
 * Inworld's own STT rather than inherit that fallback. Override per call via
 * `session.audio.input.transcription`, or disable by passing `null`.
 */
const DEFAULT_TRANSCRIPTION: InworldInputTranscription = {
  model: 'inworld/inworld-stt-1',
};

/** Default deadline for the WS handshake + initial `session.updated` round-trip. */
const DEFAULT_CONNECT_TIMEOUT_MS = 15_000;

/**
 * Curated voice list, mirroring how `@mastra/voice-openai-realtime` ships a
 * static array. Inworld accepts any voice ID from its catalog at runtime;
 * extend or fetch dynamically via `getSpeakers()`.
 */
const VOICES = ['Dennis', 'Hades', 'Wendy', 'Edward', 'Olivia', 'Sarah', 'Timothy', 'Priya', 'Ronald', 'Deborah'];

type TTools = ToolsInput;

export interface InworldRealtimeVoiceOptions {
  /** Inworld API key. Pre-Basic-encoded; passed verbatim. Falls back to `INWORLD_API_KEY`. */
  apiKey?: string;
  /** Override the realtime WebSocket endpoint. */
  url?: string;
  /** Default LLM Router model. Defaults to `inworld/models/gemma-4-26b-a4b-it`. */
  model?: string;
  /** Default voice catalog ID. Defaults to `Sarah`. */
  speaker?: string;
  /**
   * Optional client-generated session ID surfaced as the `key` URL parameter.
   * Inworld requires a per-session key; one is generated automatically if
   * omitted. Set this for replayable/observable sessions.
   */
  sessionId?: string;
  /** System prompt forwarded with the initial `session.update`. */
  instructions?: string;
  /**
   * First-class typed session config merged into every `session.update`. Use
   * this for Inworld-specific knobs (audio output speed/model, input
   * transcription, semantic-VAD eagerness, tool_choice, etc.). Deep-merged
   * with the per-call session payload — nested fields compose rather than
   * replace.
   */
  session?: Partial<InworldSessionConfig>;
  debug?: boolean;
  /**
   * Typed Inworld extension object (stt/tts/memory/backchannel/responsiveness
   * plus session-level `user_id`/`metadata`). Sent under `session.providerData`
   * in every `session.update`. Composes with `session.providerData` (deep-merged);
   * this constructor option wins on key collisions.
   */
  providerData?: InworldProviderData;
  /**
   * Max time `connect()` will wait for the WebSocket to open AND for the
   * initial `session.updated` handshake to land. A pre-open `error` or `close`
   * — or this timeout firing — surfaces as a rejected promise from `connect()`,
   * NOT an uncaught socket error. Defaults to 15s.
   */
  connectTimeoutMs?: number;
}

/**
 * InworldRealtimeVoice provides real-time voice interaction over Inworld's
 * Realtime API. The wire protocol is the OpenAI Realtime GA spec — same event
 * names on both sides (`conversation.item.added`, `conversation.item.done`,
 * `response.output_audio.delta`, etc.). Provider-level differences are the
 * endpoint, Basic auth, the URL session-key handshake, and Inworld-specific
 * session knobs surfaced through typed `session` + typed `providerData`
 * extensions (sent under `session.providerData`).
 *
 * Auth: Inworld API keys are already Basic-encoded — they are passed verbatim
 * in the `Authorization: Basic ...` header (do NOT re-encode).
 *
 * @example
 * ```typescript
 * const voice = new InworldRealtimeVoice({
 *   apiKey: process.env.INWORLD_API_KEY,
 *   // Defaults: model 'inworld/models/gemma-4-26b-a4b-it', speaker 'Sarah',
 *   // STT 'inworld/inworld-stt-1', semantic-VAD turn detection.
 *   session: {
 *     audio: {
 *       output: { speed: 1.1 },
 *       input: { turn_detection: { type: 'semantic_vad', eagerness: 'high' } },
 *     },
 *   },
 * });
 *
 * await voice.connect();
 * voice.on('speaker', stream => { /* pipe to audio out *\/ });
 * await voice.speak('Hello from Mastra!');
 * ```
 */
export class InworldRealtimeVoice extends MastraVoice {
  private ws?: WebSocket;
  private state: 'close' | 'open';
  private client: EventEmitter;
  private events: EventStore;
  private instructions?: string;
  private tools?: TTools;
  private debug: boolean;
  private queue: unknown[] = [];
  private requestContext?: RequestContext;
  private session?: Partial<InworldSessionConfig>;
  private providerData?: InworldProviderData;
  private sessionId: string;
  /** response_ids currently between `response.created` and `response.done`. */
  private activeResponseIds: Set<string> = new Set();
  /**
   * Per-response lock for the `writing` stream. Whichever of
   * `output_audio_transcript` or `output_text` fires its first delta wins, and
   * the other is suppressed for that response_id. Order-symmetric: works
   * regardless of which stream the server flushes first.
   */
  private writingSource: Map<string, 'audio_transcript' | 'text'> = new Map();
  /** Reject closures for `speak()` calls awaiting a response lifecycle. Drained on `close()`/`disconnect()`. */
  private pendingLifecycleRejecters: Set<(err: Error) => void> = new Set();
  /** Last emitted memory state version, used to dedupe rolling `memory` events. */
  private lastMemoryVersion?: number;
  /**
   * Ends + clears the per-connection stream maps owned by `setupEventListeners`
   * (the maps are closure-local). Called from `close()`/`disconnect()` so
   * in-flight back-channel streams don't leak when the socket goes away.
   */
  private endActiveStreams?: () => void;

  constructor(private options: InworldRealtimeVoiceOptions = {}) {
    super();

    this.client = new EventEmitter();
    this.state = 'close';
    this.events = {};
    this.speaker = options.speaker || DEFAULT_VOICE;
    this.debug = options.debug || false;
    this.session = options.session;
    this.providerData = options.providerData;
    this.instructions = options.instructions;
    this.sessionId = options.sessionId ?? `voice-${Date.now()}`;
  }

  /**
   * Returns the curated voice list. Inworld's voice catalog is larger than
   * this array — pass any voice ID via the `speaker` option to override.
   */
  getSpeakers(): Promise<Array<{ voiceId: string; [key: string]: any }>> {
    return Promise.resolve(VOICES.map(v => ({ voiceId: v })));
  }

  close() {
    if (!this.ws) return;
    this.ws.close();
    this.state = 'close';
    this.rejectPendingLifecycles();
    // Detach all internal routing handlers so the next `connect()` does not
    // double-fire on `client.emit`. Consumer-facing listeners on `this.events`
    // persist across reconnects.
    this.client.removeAllListeners();
    this.endActiveStreams?.();
    this.activeResponseIds.clear();
    this.writingSource.clear();
    this.lastMemoryVersion = undefined;
  }

  addInstructions(instructions?: string) {
    this.instructions = instructions;
  }

  addTools(tools?: TTools) {
    this.tools = tools || {};
  }

  /**
   * Generate speech from text. The model is asked to repeat the input
   * verbatim — this mirrors the behavior of @mastra/voice-openai-realtime.
   * A per-call `speaker` is scoped to this response only (sent via
   * `response.voice`); it does NOT mutate session state.
   *
   * Awaits the full response lifecycle: the returned promise resolves once
   * the next `response.done` (or rejects on `interrupted` / `error`) for
   * this `speak()` invocation. Serial `speak()` calls are supported;
   * concurrent calls share the same listener pool and have undefined
   * response-pinning order — most voice apps serialize.
   */
  async speak(input: string | NodeJS.ReadableStream, options?: { speaker?: string }): Promise<void> {
    if (typeof input !== 'string') {
      const chunks: Buffer[] = [];
      for await (const chunk of input) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      }
      input = Buffer.concat(chunks).toString('utf-8');
    }

    if (input.trim().length === 0) {
      throw new Error('Input text is empty');
    }

    // Register the lifecycle waiter BEFORE sending `response.create` so we
    // can't miss the `response.created` event the server emits in reply.
    const done = this.awaitResponseLifecycle();

    this.sendEvent('conversation.item.create', {
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: input }],
      },
    });

    const response: InworldResponseConfig = {
      instructions: `Repeat the following text: ${input}`,
    };
    if (options?.speaker) {
      response.voice = options.speaker;
    }
    this.sendEvent('response.create', { response });

    await done;
  }

  /**
   * Resolves on the next `response.done`, pinned by the `response.id`
   * observed on the first `response.created` after registration. Rejects on
   * `error` and on the synthetic `interrupted` signal for the pinned id.
   */
  private awaitResponseLifecycle(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let pinnedId: string | undefined;

      const cleanup = () => {
        this.client.removeListener('response.created', onCreated);
        this.client.removeListener('response.done', onDone);
        this.client.removeListener('error', onError);
        this.client.removeListener('interrupted', onInterrupt);
        this.pendingLifecycleRejecters.delete(rejectWith);
      };

      const rejectWith = (err: Error) => {
        cleanup();
        reject(err);
      };

      const onCreated = (ev: any) => {
        if (pinnedId) return;
        pinnedId = ev?.response?.id;
      };

      const onDone = (ev: any) => {
        if (!pinnedId || ev?.response?.id !== pinnedId) return;
        cleanup();
        resolve();
      };

      const onInterrupt = (ev: { response_id: string }) => {
        if (!pinnedId || ev.response_id !== pinnedId) return;
        rejectWith(new Error(`Response ${pinnedId} was interrupted by user speech`));
      };

      const onError = (err: unknown) => {
        rejectWith(err instanceof Error ? err : new Error(String(err)));
      };

      this.pendingLifecycleRejecters.add(rejectWith);
      this.client.on('response.created', onCreated);
      this.client.on('response.done', onDone);
      this.client.on('error', onError);
      this.client.on('interrupted', onInterrupt);
    });
  }

  /**
   * Apply a new session config. The typed `session` constructor field is
   * deep-merged into the per-call payload, so nested fields (e.g.
   * `audio.output.voice` + `audio.output.speed`) compose rather than overwrite
   * each other. The constructor `providerData` is nested under
   * `session.providerData` (matching Inworld's wire field) and deep-merged on
   * top of any `session.providerData` set via the `session` field — the
   * constructor option wins on key collisions.
   */
  updateConfig(sessionConfig: Partial<InworldSessionConfig> | Record<string, unknown>): void {
    let merged: Record<string, unknown> = { ...sessionConfig } as Record<string, unknown>;
    if (this.session) merged = deepMerge(merged, this.session as Record<string, unknown>);
    if (this.providerData) {
      const existing = (merged.providerData as Record<string, unknown> | undefined) ?? {};
      merged.providerData = deepMerge(existing, this.providerData as Record<string, unknown>);
    }
    this.sendEvent('session.update', { session: merged });
  }

  async getListener() {
    return { enabled: true };
  }

  /**
   * Send an audio buffer to the realtime endpoint as a single user turn and
   * request a text-only transcription response.
   */
  async listen(audioData: NodeJS.ReadableStream): Promise<void> {
    if (isReadableStream(audioData)) {
      const chunks: Buffer[] = [];
      for await (const chunk of audioData) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        chunks.push(buffer);
      }

      const buffer = Buffer.concat(chunks);
      const int16Array = new Int16Array(buffer.buffer, buffer.byteOffset ?? 0, (buffer.byteLength ?? 0) / 2);
      const base64Audio = this.int16ArrayToBase64(int16Array);

      this.sendEvent('conversation.item.create', {
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_audio', audio: base64Audio }],
        },
      });

      this.sendEvent('response.create', {
        response: {
          output_modalities: ['text'],
          instructions: `ONLY repeat the input and DO NOT say anything else`,
        },
      });
    } else {
      this.emit('error', new Error('Unsupported audio data format'));
    }
  }

  /**
   * Resolves once the WebSocket emits `open`. Rejects on a pre-open `error`
   * or `close`, and on a connect-timeout. Mirrors the pattern from
   * `@mastra/voice-google-gemini-live-api` (ConnectionManager.waitForOpen).
   */
  waitForOpen(timeoutMs: number = this.options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws) {
        reject(new Error('WebSocket not initialized'));
        return;
      }

      if (this.ws.readyState === this.ws.OPEN) {
        resolve();
        return;
      }

      const onOpen = () => {
        cleanup();
        resolve();
      };
      const onError = (err: Error) => {
        cleanup();
        reject(new Error(`Inworld realtime WebSocket failed to open: ${err?.message ?? String(err)}`));
      };
      const onClose = () => {
        cleanup();
        reject(new Error('Inworld realtime WebSocket closed before opening'));
      };
      const cleanup = () => {
        this.ws?.removeListener('open', onOpen);
        this.ws?.removeListener('error', onError);
        this.ws?.removeListener('close', onClose);
        clearTimeout(timer);
      };

      this.ws.once('open', onOpen);
      this.ws.once('error', onError);
      this.ws.once('close', onClose);

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Inworld realtime WebSocket connection timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  /**
   * Resolves on the first `session.updated` event. Inworld emits
   * `session.created` immediately on connect (despite older docs claiming
   * otherwise), but `session.updated` is the canonical handshake completion
   * because our `connect()` sends a `session.update` before declaring ready.
   *
   * Rejects with a clear error if the server does not acknowledge within
   * `timeoutMs` — otherwise `connect()` would hang forever on a half-open
   * socket.
   */
  waitForSessionCreated(
    timeoutMs: number = this.options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = this.ws;
      let transportAttached = false;
      const cleanup = () => {
        clearTimeout(timer);
        this.client.removeListener('session.updated', onUpdated);
        ws?.removeListener('open', onOpen);
        if (transportAttached) {
          ws?.removeListener('close', onClose);
          ws?.removeListener('error', onError);
        }
      };
      const onUpdated = () => {
        cleanup();
        resolve();
      };
      // Only listen for close/error AFTER the socket is open. `waitForOpen()`
      // owns pre-open transport failures; attaching here too would double-reject
      // (and surface unhandled rejections, since `connect()` only awaits the
      // open promise on that path).
      const onClose = (code?: number, reason?: Buffer) => {
        cleanup();
        reject(
          new Error(
            `Inworld realtime websocket closed during handshake (code=${code ?? '?'}, reason=${reason?.toString() || 'n/a'})`,
          ),
        );
      };
      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };
      const attachTransport = () => {
        if (transportAttached) return;
        transportAttached = true;
        ws?.once('close', onClose);
        ws?.once('error', onError);
      };
      const onOpen = () => attachTransport();

      this.client.once('session.updated', onUpdated);
      if (ws && ws.readyState === ws.OPEN) {
        attachTransport();
      } else {
        ws?.once('open', onOpen);
      }
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Inworld realtime session handshake timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  /**
   * Open the websocket, send the initial `session.update`, and wait for
   * `session.updated`.
   *
   * URL contract: Inworld's Realtime WebSocket requires a client-generated
   * session ID (`?key=...`) and `&protocol=realtime`. The model is configured
   * via the initial `session.update`, NOT the URL.
   *
   * A pre-open error/close on the WebSocket — or a timeout exceeding
   * `connectTimeoutMs` (15s default) — surfaces as a rejected promise
   * instead of an uncaught socket error. On reject, the half-open socket
   * is closed.
   */
  async connect({ requestContext }: { requestContext?: RequestContext } = {}) {
    const baseUrl = this.options.url || DEFAULT_URL;
    const url = `${baseUrl}?key=${encodeURIComponent(this.sessionId)}&protocol=realtime`;
    const apiKey = this.options.apiKey || process.env.INWORLD_API_KEY;
    if (!apiKey) {
      throw new Error(
        'Missing Inworld API key. Pass `apiKey` to InworldRealtimeVoice or set INWORLD_API_KEY. Keys ship pre-Basic-encoded; paste verbatim.',
      );
    }
    this.requestContext = requestContext;

    this.ws = new WebSocket(url, undefined, {
      headers: {
        // Inworld API keys are pre-Basic-encoded; pass verbatim.
        Authorization: 'Basic ' + apiKey,
      },
    });

    this.setupEventListeners();

    let ready: Promise<void> | undefined;
    try {
      const opened = this.waitForOpen();
      ready = this.waitForSessionCreated();
      await opened;

      // Compose the connect-time defaults. The typed `session` field is
      // deep-merged on top in updateConfig() (and `providerData` is nested under
      // `session.providerData` there). `turn_detection` and `transcription` are
      // each opted out by setting them to `null` in `session`; we also skip a
      // default whenever `session` supplies that field explicitly, so the user's
      // shape doesn't inherit our defaults' nested fields.
      const userTd = this.userTurnDetection();
      const userTranscription = this.userTranscription();
      const audio: NonNullable<InworldSessionConfig['audio']> = {
        output: { voice: this.speaker },
      };
      const input: NonNullable<InworldSessionConfig['audio']>['input'] = {};
      if (userTd === undefined) {
        input.turn_detection = { ...DEFAULT_TURN_DETECTION };
      }
      if (userTranscription === undefined) {
        input.transcription = { ...DEFAULT_TRANSCRIPTION };
      }
      if (Object.keys(input).length > 0) {
        audio.input = input;
      }
      const initial: Partial<InworldSessionConfig> = {
        model: this.options.model || DEFAULT_MODEL,
        instructions: this.instructions,
        tools: transformTools(this.tools),
        audio,
      };
      this.updateConfig(initial);

      await ready;
      this.state = 'open';
    } catch (err) {
      // Close the half-open socket so we don't leak file descriptors.
      try {
        this.ws?.close();
      } catch {
        // ignore
      }
      this.state = 'close';
      this.client.removeAllListeners();
      throw err;
    }
  }

  disconnect() {
    this.state = 'close';
    this.ws?.close();
    this.rejectPendingLifecycles();
    this.client.removeAllListeners();
    this.endActiveStreams?.();
    this.activeResponseIds.clear();
    this.writingSource.clear();
    this.lastMemoryVersion = undefined;
  }

  /**
   * Reject any in-flight `speak()` awaiters. Called from `close()`/`disconnect()`
   * so a consumer cleanup pattern never hangs waiting for a `response.done`
   * that will never arrive.
   */
  private rejectPendingLifecycles(): void {
    if (this.pendingLifecycleRejecters.size === 0) return;
    const err = new Error('Inworld realtime voice closed while a response was in flight');
    for (const rej of this.pendingLifecycleRejecters) rej(err);
    this.pendingLifecycleRejecters.clear();
  }

  async send(audioData: NodeJS.ReadableStream | Int16Array, eventId?: string): Promise<void> {
    if (!this.state || this.state !== 'open') {
      console.warn('Cannot send audio when not open. Call connect() first.');
      return;
    }

    if (isReadableStream(audioData)) {
      const stream = audioData as NodeJS.ReadableStream;
      stream.on('data', chunk => {
        try {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          this.sendEvent('input_audio_buffer.append', { audio: buffer.toString('base64'), event_id: eventId });
        } catch (err) {
          this.emit('error', err);
        }
      });
    } else if (audioData instanceof Int16Array) {
      try {
        const base64Audio = this.int16ArrayToBase64(audioData);
        this.sendEvent('input_audio_buffer.append', { audio: base64Audio, event_id: eventId });
      } catch (err) {
        this.emit('error', err);
      }
    } else {
      this.emit('error', new Error('Unsupported audio data format'));
    }
  }

  async answer({ options }: { options?: Record<string, unknown> } = {}) {
    this.sendEvent('response.create', { response: options ?? {} });
  }

  /**
   * Manually commit buffered input audio as a user turn. Use for push-to-talk
   * or manual turn-taking when `turn_detection` is `null` (no auto-VAD).
   */
  commitInput(): void {
    this.sendEvent('input_audio_buffer.commit', {});
  }

  /**
   * Discard buffered input audio without committing it as a user turn.
   */
  clearInput(): void {
    this.sendEvent('input_audio_buffer.clear', {});
  }

  /**
   * Clear the server's ENTIRE output audio buffer, stopping playback. This also
   * stops any in-flight BACK-CHANNEL audio. The default barge-in path
   * (`response.cancel` on `interrupted`) is back-channel-safe; prefer it. Use
   * `clearOutput()` only when you explicitly want to flush everything.
   */
  clearOutput(): void {
    this.sendEvent('output_audio_buffer.clear', {});
  }

  on<E extends keyof InworldVoiceEventMap>(event: E, callback: (data: InworldVoiceEventMap[E]) => void): void;
  on(event: string, callback: EventCallback): void;
  on(event: string, callback: EventCallback): void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  off<E extends keyof InworldVoiceEventMap>(event: E, callback: (data: InworldVoiceEventMap[E]) => void): void;
  off(event: string, callback: EventCallback): void;
  off(event: string, callback: EventCallback): void {
    if (!this.events[event]) return;

    const index = this.events[event].indexOf(callback);
    if (index !== -1) {
      this.events[event].splice(index, 1);
    }
  }

  private emit(event: string, ...args: any[]): void {
    if (!this.events[event]) return;

    for (const callback of this.events[event]) {
      callback(...args);
    }
  }

  private setupEventListeners(): void {
    const speakerStreams = new Map<string, StreamWithId>();
    const backchannelStreams = new Map<string, StreamWithId>();
    const functionCallArgs = new Map<string, string>();

    if (!this.ws) {
      throw new Error('WebSocket not initialized');
    }

    // Wipe stale routing from a previous `connect()` before re-registering.
    // Reconnects (or test resets) would otherwise double-fire every event.
    // Consumer-facing handlers on `this.events` are intentionally preserved.
    this.client.removeAllListeners();
    this.activeResponseIds.clear();
    this.writingSource.clear();
    this.lastMemoryVersion = undefined;

    // Lets close()/disconnect() drain the closure-local stream maps below.
    this.endActiveStreams = () => {
      for (const stream of speakerStreams.values()) stream.end();
      speakerStreams.clear();
      for (const stream of backchannelStreams.values()) stream.end();
      backchannelStreams.clear();
    };

    this.ws.on('message', message => {
      // Surface malformed inbound frames as `error` events. Without the try,
      // a JSON.parse throw escapes the socket listener and crashes the process.
      let data: any;
      try {
        data = JSON.parse(message.toString());
      } catch (err) {
        this.emit('error', err instanceof Error ? err : new Error(`Invalid server frame: ${String(err)}`));
        return;
      }
      this.client.emit(data.type, data);

      if (this.debug) {
        const { delta, ...fields } = data;
        console.info(data.type, fields, delta && delta.length < 100 ? delta : '');
      }
    });

    this.client.on('session.created', ev => {
      this.emit('session.created', ev);
    });

    this.client.on('session.updated', ev => {
      this.emit('session.updated', ev);

      // Inworld echoes its rolling memory state back on the session object.
      // Dedupe by version so a `session.updated` for an unrelated config change
      // doesn't re-emit an unchanged memory snapshot.
      const memoryState: InworldMemoryState | undefined = ev.session?.providerData?.memory?.state;
      if (memoryState) {
        if (memoryState.version === undefined || memoryState.version !== this.lastMemoryVersion) {
          this.lastMemoryVersion = memoryState.version;
          this.emit('memory', memoryState);
        }
      }

      const queue = this.queue.splice(0, this.queue.length);
      for (const queued of queue) {
        this.ws?.send(JSON.stringify(queued));
      }
    });

    this.client.on('response.created', ev => {
      this.activeResponseIds.add(ev.response.id);
      this.emit('response.created', ev);

      const speakerStream = new PassThrough() as StreamWithId;
      speakerStream.id = ev.response.id;

      speakerStreams.set(ev.response.id, speakerStream);
      this.emit('speaker', speakerStream);
    });

    // GA-spec per-item lifecycle: `added` (item appended) and `done` (item
    // finished). Surface both upward so consumers can drive UI from either edge.
    this.client.on('conversation.item.added', ev => {
      this.emit('conversation.item.added', ev);
    });
    this.client.on('conversation.item.done', ev => {
      this.emit('conversation.item.done', ev);
    });

    // Barge-in. We fire `interrupted` (and a server-side `response.cancel`)
    // for each in-flight response from multiple "user is speaking now" signals,
    // because semantic_vad doesn't always emit `speech_started` quickly enough
    // when the bot's own audio is bleeding into the mic. The dedupe set keeps
    // us from emitting twice per response when several signals fire in a row.
    const interruptedFor = new Set<string>();
    const fireInterruptedForActive = () => {
      if (this.activeResponseIds.size === 0) return;
      const td = this.userTurnDetection() ?? DEFAULT_TURN_DETECTION;
      const shouldCancel = td?.interrupt_response !== false;
      for (const responseId of this.activeResponseIds) {
        if (interruptedFor.has(responseId)) continue;
        interruptedFor.add(responseId);
        const payload = { response_id: responseId };
        this.emit('interrupted', payload);
        // Internal channel for `speak()`'s awaiter (see awaitResponseLifecycle).
        this.client.emit('interrupted', payload);
        if (shouldCancel) {
          this.sendEvent('response.cancel', { response_id: responseId });
        }
      }
    };

    this.client.on('input_audio_buffer.speech_started', ev => {
      this.emit('speech-started', ev);
      fireInterruptedForActive();
    });
    this.client.on('input_audio_buffer.speech_stopped', ev => {
      this.emit('speech-stopped', ev);
    });

    // Smart-turn endpointing + manual turn-taking acks. These re-emit the raw
    // server events under ergonomic names; the trailing/duration/inference
    // timings are optional and passed through only when present.
    this.client.on('input_audio_buffer.turn_suggestion', ev => {
      this.emit('turn-suggestion', {
        item_id: ev.item_id,
        utterance_index: ev.utterance_index,
        probability: ev.probability,
        trailing_silence_ms: ev.trailing_silence_ms,
        audio_duration_ms: ev.audio_duration_ms,
        inference_ms: ev.inference_ms,
      });
    });
    this.client.on('input_audio_buffer.turn_suggestion_revoked', ev => {
      this.emit('turn-suggestion-revoked', { item_id: ev.item_id, utterance_index: ev.utterance_index });
    });
    this.client.on('input_audio_buffer.committed', ev => {
      this.emit('input-committed', { item_id: ev.item_id, previous_item_id: ev.previous_item_id });
    });
    this.client.on('input_audio_buffer.cleared', () => {
      this.emit('input-cleared', {});
    });
    this.client.on('input_audio_buffer.timeout_triggered', ev => {
      this.emit('input-timeout', {
        audio_start_ms: ev.audio_start_ms,
        audio_end_ms: ev.audio_end_ms,
        item_id: ev.item_id,
      });
    });

    // Output playback-state signals. None carry a response_id on the wire.
    this.client.on('output_audio_buffer.started', () => {
      this.emit('output-audio-started', {});
    });
    this.client.on('output_audio_buffer.stopped', () => {
      this.emit('output-audio-stopped', {});
    });
    this.client.on('output_audio_buffer.cleared', () => {
      this.emit('output-audio-cleared', {});
    });
    // STT deltas are a near-realtime "user is talking" signal that fires even
    // when semantic_vad has suppressed `speech_started`. Treat the first one
    // during an active response as a barge-in trigger.
    this.client.on('conversation.item.input_audio_transcription.delta', () => {
      fireInterruptedForActive();
    });

    // GA spec audio deltas (NOT preview-spec `response.audio.delta`).
    this.client.on('response.output_audio.delta', ev => {
      const audio = Buffer.from(ev.delta, 'base64');
      this.emit('speaking', { audio, response_id: ev.response_id });

      const stream = speakerStreams.get(ev.response_id);
      stream?.write(audio);
    });
    this.client.on('response.output_audio.done', ev => {
      this.emit('speaking.done', { response_id: ev.response_id });

      const stream = speakerStreams.get(ev.response_id);
      stream?.end();
    });

    // Inworld can emit both `output_audio_transcript.delta` AND
    // `output_text.delta` for the same response when audio+text modalities
    // are both active. Lock the canonical `writing` source on the first
    // delta seen for the response_id (symmetric: whichever stream arrives
    // first wins). The trailing `\n` on `.done` follows the same lock so it
    // only fires for the chosen source.
    this.client.on('response.output_audio_transcript.delta', ev => {
      const src = this.writingSource.get(ev.response_id);
      if (src === undefined) this.writingSource.set(ev.response_id, 'audio_transcript');
      else if (src !== 'audio_transcript') return;
      this.emit('writing', { text: ev.delta, response_id: ev.response_id, role: 'assistant' });
    });
    this.client.on('response.output_audio_transcript.done', ev => {
      if (this.writingSource.get(ev.response_id) !== 'audio_transcript') return;
      this.emit('writing', { text: '\n', response_id: ev.response_id, role: 'assistant' });
    });

    this.client.on('response.output_text.delta', ev => {
      const src = this.writingSource.get(ev.response_id);
      if (src === undefined) this.writingSource.set(ev.response_id, 'text');
      else if (src !== 'text') return;
      this.emit('writing', { text: ev.delta, response_id: ev.response_id, role: 'assistant' });
    });
    this.client.on('response.output_text.done', ev => {
      if (this.writingSource.get(ev.response_id) !== 'text') return;
      this.emit('writing', { text: '\n', response_id: ev.response_id, role: 'assistant' });
    });

    // User-side ASR. Transcription defaults to `inworld/inworld-stt-1` (set it
    // to `null` in `session`/`providerData` to disable). The OpenAI
    // Realtime GA spec describes `.delta` events as additive chunks, but Inworld
    // currently sends rolling-rewrite deltas (each one is the full transcript
    // so far). Streaming those naively would duplicate text, so we ignore deltas
    // and emit the final transcript once on `.completed`.
    this.client.on('conversation.item.input_audio_transcription.completed', ev => {
      // Voice profile (age/gender/emotion/...) rides along on the completed
      // transcript when `providerData.stt.voice_profile` is enabled. Attach it
      // to the user `writing` emit; it's optional and may be undefined.
      const voiceProfile: InworldVoiceProfile | undefined = ev.providerData?.voiceProfile;
      if (typeof ev.transcript === 'string' && ev.transcript.length > 0) {
        this.emit('writing', { text: ev.transcript, response_id: ev.item_id, role: 'user', voiceProfile });
      }
      this.emit('writing', { text: '\n', response_id: ev.item_id, role: 'user' });
    });

    // Inworld uses the SINGULAR `function_call_arguments` (docs claim plural;
    // the live API emits singular). Accumulate the argument JSON across deltas
    // and parse on `.done` to expose a complete payload.
    this.client.on('response.function_call_arguments.delta', ev => {
      const prev = functionCallArgs.get(ev.call_id) || '';
      functionCallArgs.set(ev.call_id, prev + (ev.delta || ''));
    });
    this.client.on('response.function_call_arguments.done', ev => {
      const args = functionCallArgs.get(ev.call_id) ?? ev.arguments ?? '';
      functionCallArgs.delete(ev.call_id);
      this.emit('function_call.arguments', {
        call_id: ev.call_id,
        name: ev.name,
        arguments: args,
      });
    });

    // Back-channel audio. Short acknowledgements ("uh-huh", "right") that the
    // model emits while the user is still talking. Mirrors the `speaker` stream
    // pattern: a PassThrough per `backchannel_id`, written from base64 deltas.
    this.client.on('response.backchannel.audio.delta', ev => {
      const audio = Buffer.from(ev.delta, 'base64');
      let stream = backchannelStreams.get(ev.backchannel_id);
      if (!stream) {
        stream = new PassThrough() as StreamWithId;
        stream.id = ev.backchannel_id;
        backchannelStreams.set(ev.backchannel_id, stream);
        this.emit('backchannel', stream);
      }
      stream.write(audio);
    });
    this.client.on('response.backchannel.audio.done', ev => {
      const stream = backchannelStreams.get(ev.backchannel_id);
      stream?.end();
      backchannelStreams.delete(ev.backchannel_id);
      this.emit('backchannel.done', { backchannel_id: ev.backchannel_id, phrase: ev.phrase });
    });
    // The decider can skip a back-channel before any audio is produced.
    this.client.on('response.backchannel.skipped', ev => {
      this.emit('backchannel.skipped', { reason: ev.reason });
    });

    this.client.on('response.done', ev => {
      // Emit + clean up FIRST so downstream `response.done` observers and
      // barge-in logic don't sit behind tool latency, then kick off tool work.
      this.emit('response.done', ev);
      speakerStreams.delete(ev.response.id);
      this.activeResponseIds.delete(ev.response.id);
      this.writingSource.delete(ev.response.id);
      interruptedFor.delete(ev.response.id);
      void this.handleFunctionCalls(ev).catch(err => {
        this.emit('error', err instanceof Error ? err : new Error(String(err)));
      });
    });

    this.client.on('error', async ev => {
      this.emit('error', ev);
    });
  }

  /**
   * Returns the user-supplied `turn_detection` value (or `null` for explicit
   * opt-out), or `undefined` when it isn't set. `turn_detection` is a standard
   * `audio.input` field (not a providerData extension), so it's read only from
   * `session`. Used to decide whether to apply `DEFAULT_TURN_DETECTION`.
   */
  private userTurnDetection(): InworldTurnDetection | null | undefined {
    return this.session?.audio?.input?.turn_detection;
  }

  /**
   * Returns the user-supplied `transcription` value (or `null` for explicit
   * opt-out), or `undefined` when it isn't set. `transcription` is a standard
   * `audio.input` field (not a providerData extension), so it's read only from
   * `session`. Used to decide whether to apply `DEFAULT_TRANSCRIPTION`.
   */
  private userTranscription(): InworldInputTranscription | null | undefined {
    return this.session?.audio?.input?.transcription;
  }

  private async handleFunctionCalls(ev: any) {
    for (const output of ev.response?.output ?? []) {
      if (output.type === 'function_call') {
        await this.handleFunctionCall(output);
      }
    }
  }

  private async handleFunctionCall(output: any) {
    try {
      // Zero-arg tools come back with `arguments: ""` (or missing); treat
      // that as `{}` so the Zod input parse doesn't blow up on no-args.
      const context = JSON.parse(output.arguments || '{}');
      const tool = this.tools?.[output.name];
      if (!tool) {
        console.warn(`Tool "${output.name}" not found`);
        return;
      }

      if (tool?.execute) {
        this.emit('tool-call-start', {
          toolCallId: output.call_id,
          toolName: output.name,
          toolDescription: tool.description,
          args: context,
        });
      }

      const result = await tool?.execute?.(context, {
        toolCallId: output.call_id,
        messages: [],
        requestContext: this.requestContext,
      });

      this.emit('tool-call-result', {
        toolCallId: output.call_id,
        toolName: output.name,
        toolDescription: tool.description,
        args: context,
        result,
      });

      this.sendEvent('conversation.item.create', {
        item: {
          type: 'function_call_output',
          call_id: output.call_id,
          output: JSON.stringify(result),
        },
      });
    } catch (e) {
      const err = e as Error;
      console.warn(`Error calling tool "${output.name}":`, err.message);
      this.sendEvent('conversation.item.create', {
        item: {
          type: 'function_call_output',
          call_id: output.call_id,
          output: JSON.stringify({ error: err.message }),
        },
      });
    } finally {
      this.sendEvent('response.create', {});
    }
  }

  private int16ArrayToBase64(int16Array: Int16Array): string {
    const buffer = new ArrayBuffer(int16Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < int16Array.length; i++) {
      view.setInt16(i * 2, int16Array[i]!, true);
    }
    const uint8Array = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]!);
    }
    return btoa(binary);
  }

  private sendEvent(type: string, data: any) {
    if (!this.ws || this.ws.readyState !== this.ws.OPEN) {
      this.queue.push({ type: type, ...data });
    } else {
      this.ws?.send(
        JSON.stringify({
          type: type,
          ...data,
        }),
      );
    }
  }
}

export type {
  InworldAudioConfig,
  InworldAudioFormat,
  InworldAudioInput,
  InworldAudioOutput,
  InworldBackchannelProviderData,
  InworldInputTranscription,
  InworldMemoryProviderData,
  InworldMemoryState,
  InworldNoiseReduction,
  InworldProviderData,
  InworldResponseConfig,
  InworldResponsivenessProviderData,
  InworldSessionConfig,
  InworldSttProviderData,
  InworldToolChoice,
  InworldTracing,
  InworldTtsProviderData,
  InworldTurnDetection,
  InworldVoiceEventMap,
  InworldVoiceProfile,
  InworldVoiceProfileLabel,
} from './types';
