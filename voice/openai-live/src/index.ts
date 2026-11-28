import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { ToolsInput } from '@internal/voice';
import { MastraVoice } from '@internal/voice';
import { WebSocket } from 'ws';
import {
  AUDIO_FORMAT,
  CLIENT_EVENTS,
  DEFAULT_DELEGATION_MODEL,
  DEFAULT_MODEL,
  DEFAULT_USER_AGENT,
  DEFAULT_VOICE,
  DELEGATION_MODES,
  LIVE_WS_URL,
  RESPONSE_EVENTS,
  SERVER_EVENTS,
  VOICES,
} from './protocol';
import { isReadableStream, transformTools } from './utils';
import type { OpenAIExecuteFunction } from './utils';

type EventCallback = (...args: any[]) => void;

type StreamWithId = PassThrough & { id: string };

type TTools = ToolsInput;

/**
 * Delegation configuration sent in `session.start`. Under `responses`
 * delegation a backend Responses model handles reasoning and tool calls; under
 * `client` delegation the application receives `delegation` events and reports
 * back with `sendDelegationResult`.
 */
export interface OpenAILiveDelegationConfig {
  type: 'responses' | 'client';
  acknowledgement_delay_ms?: number;
  responses?: {
    model?: string;
    tools?: unknown[];
    tool_choice?: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface OpenAILiveVoiceConfig {
  /** OpenAI API key. Falls back to process.env.OPENAI_API_KEY. */
  apiKey?: string;
  /** Live model id. Defaults to 'gpt-live-1'. */
  model?: string;
  /** Voice/speaker id. Defaults to 'marin'. */
  speaker?: string;
  /** Live WebSocket URL. Defaults to the OpenAI Live endpoint. */
  url?: string;
  /** User-Agent header identifying your app to OpenAI. */
  userAgent?: string;
  /** System instructions for the session. */
  instructions?: string;
  /** Tools to advertise to the session. */
  tools?: TTools;
  /** Backend delegation configuration forwarded to the session. */
  delegation?: OpenAILiveDelegationConfig;
  /** Extra session config merged into the session.start payload. */
  sessionConfig?: Record<string, unknown>;
  /** Maximum connection handshake duration in milliseconds. Defaults to 15,000. */
  connectTimeoutMs?: number;
  /** Enable verbose logging of inbound events. */
  debug?: boolean;
}

/**
 * OpenAILiveVoice provides real-time, full-duplex voice interaction using
 * OpenAI's Live API (`/v1/live/sessions`) over a server WebSocket.
 *
 * It implements the shared Mastra speech-to-speech contract: connect, stream
 * audio via `send`, drive speech via `speak`, and receive audio (`speaker`)
 * and transcripts (`writing`) as events. Backend reasoning/tool delegation is
 * forwarded to the Live session via the `delegation` config.
 *
 * The Live API is distinct from OpenAI's Realtime API — different endpoint,
 * event contract, and delegation architecture — so this is a separate provider
 * from `@mastra/voice-openai-realtime`.
 *
 * @example
 * ```typescript
 * const voice = new OpenAILiveVoice({
 *   apiKey: process.env.OPENAI_API_KEY,
 *   model: 'gpt-live-1',
 *   speaker: 'marin',
 * });
 * await voice.connect();
 * voice.on('speaker', stream => stream.pipe(playback));
 * await voice.send(getMicrophoneStream());
 * ```
 */
export class OpenAILiveVoice extends MastraVoice {
  private ws?: WebSocket;
  private state: 'close' | 'open';
  private client: EventEmitter;
  private events: Record<string, EventCallback[]>;
  private instructions?: string;
  private tools?: TTools;
  private delegation?: OpenAILiveDelegationConfig;
  private sessionConfig?: Record<string, unknown>;
  private debug: boolean;
  private pendingToolCalls: Map<string, Promise<void>[]> = new Map();
  private connectionAbort?: AbortController;
  private toolExecutors: Map<string, OpenAIExecuteFunction> = new Map();
  private speakerStream?: StreamWithId;

  constructor(private liveOptions: OpenAILiveVoiceConfig = {}) {
    super();

    if (
      liveOptions.connectTimeoutMs !== undefined &&
      (!Number.isFinite(liveOptions.connectTimeoutMs) ||
        liveOptions.connectTimeoutMs <= 0 ||
        liveOptions.connectTimeoutMs > 2_147_483_647)
    ) {
      throw new Error('connectTimeoutMs must be a positive finite number no greater than 2147483647');
    }

    this.client = new EventEmitter();
    this.state = 'close';
    this.events = {};
    this.speaker = liveOptions.speaker || DEFAULT_VOICE;
    this.instructions = liveOptions.instructions;
    this.tools = liveOptions.tools;
    this.delegation = liveOptions.delegation;
    this.sessionConfig = liveOptions.sessionConfig;
    this.debug = liveOptions.debug || false;
  }

  /**
   * Returns the list of known Live speaker voices.
   */
  getSpeakers(): Promise<Array<{ voiceId: string; [key: string]: any }>> {
    return Promise.resolve(VOICES.map(v => ({ voiceId: v })));
  }

  /**
   * Checks if listening capabilities are enabled.
   */
  async getListener() {
    return { enabled: true };
  }

  /**
   * Sets the session instructions. Instructions are fixed once the session has
   * started, so while connected they are appended with `session.instructions.append`.
   */
  addInstructions(instructions?: string) {
    this.instructions = instructions;
    if (this.state === 'open' && instructions) {
      this.sendEvent(CLIENT_EVENTS.instructionsAppend, { delegation_id: null, content: instructions });
    }
  }

  /**
   * Sets the tools available to the backend. While connected under `responses`
   * delegation the new list is sent with `session.update`.
   */
  addTools(tools?: TTools) {
    this.tools = tools || {};
    if (this.state === 'open') this.sendDelegationUpdate();
  }

  /**
   * Merges extra fields into the `session.start` payload used on the next
   * connect. GPT-Live only accepts `delegation` changes after startup, so a
   * `delegation` field is also sent to an open session.
   */
  updateConfig(sessionConfig: Record<string, unknown>): void {
    this.sessionConfig = { ...this.sessionConfig, ...sessionConfig };
    if ('delegation' in sessionConfig) {
      this.delegation = sessionConfig.delegation as OpenAILiveDelegationConfig | undefined;
      if (this.state === 'open') this.sendDelegationUpdate();
    }
  }

  /**
   * Opens the Live session: connects the socket, sends `session.start` and waits
   * for `session.started`. Must be called before `send` or `speak`.
   */
  async connect({ timeout }: { timeout?: number } = {}): Promise<void> {
    const url = this.liveOptions.url || LIVE_WS_URL;
    const apiKey = this.liveOptions.apiKey || process.env.OPENAI_API_KEY;

    // Tear down any existing connection before opening a new one to avoid leaks.
    if (this.ws) this.close();

    this.ws = new WebSocket(url, undefined, {
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'User-Agent': this.liveOptions.userAgent || DEFAULT_USER_AGENT,
      },
    });

    const ws = this.ws;
    this.state = 'close';
    this.client.removeAllListeners();
    const controller = new AbortController();
    this.connectionAbort = controller;
    this.setupEventListeners();

    const timeoutMs = timeout ?? this.liveOptions.connectTimeoutMs ?? 15_000;
    const deadline = Date.now() + timeoutMs;
    try {
      await this.waitForHandshake('open', timeoutMs);
      const started = this.waitForHandshake(SERVER_EVENTS.sessionStarted, Math.max(deadline - Date.now(), 1));
      ws.send(JSON.stringify({ type: CLIENT_EVENTS.sessionStart, session: this.buildSessionConfig() }));
      await started;
    } catch (error) {
      controller.abort(error);
      this.state = 'close';
      this.ws = undefined;
      ws.close();
      throw error;
    } finally {
      this.connectionAbort = undefined;
    }

    this.state = 'open';
  }

  disconnect() {
    this.connectionAbort?.abort(new Error('OpenAI Live connection disconnected during handshake'));
    this.close();
  }

  /**
   * Closes the Live session and cleans up resources. Shared teardown path for
   * both `close()` and `disconnect()`.
   */
  close() {
    const ws = this.ws;
    if (ws) {
      if (this.state === 'open' && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: CLIENT_EVENTS.sessionClose }));
        } catch {
          // best-effort; the socket is being torn down regardless
        }
      }
      ws.close();
    }

    this.endSpeakerStream();
    this.pendingToolCalls.clear();
    this.state = 'close';
    this.ws = undefined;
  }

  /**
   * Streams caller audio (24 kHz mono PCM16) to the Live session. Accepts a
   * readable stream or an Int16Array of samples.
   */
  async send(audioData: NodeJS.ReadableStream | Int16Array): Promise<void> {
    if (this.state !== 'open') {
      console.warn('Cannot send audio when not connected. Call connect() first.');
      return;
    }

    if (isReadableStream(audioData)) {
      const stream = audioData as NodeJS.ReadableStream;
      await new Promise<void>((resolve, reject) => {
        stream.on('data', chunk => {
          try {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            if (buffer.length > 0) this.sendEvent(CLIENT_EVENTS.inputAudioAppend, { audio: buffer.toString('base64') });
          } catch (err) {
            this.emit('error', err);
            reject(err as Error);
          }
        });
        stream.on('error', err => {
          this.emit('error', err);
          reject(err as Error);
        });
        stream.on('end', () => resolve());
      });
    } else if (audioData instanceof Int16Array) {
      try {
        if (audioData.length > 0) {
          this.sendEvent(CLIENT_EVENTS.inputAudioAppend, { audio: this.int16ArrayToBase64(audioData) });
        }
      } catch (err) {
        this.emit('error', err);
      }
    } else {
      this.emit('error', new Error('Unsupported audio data format'));
    }
  }

  /**
   * Gives the model text to speak with `session.commentary.append`. GPT-Live is
   * server-driven, so the model decides when to say it. Commonly used to open a
   * call with a greeting after connecting.
   */
  async speak(input: string | NodeJS.ReadableStream): Promise<void> {
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

    if (this.state !== 'open') {
      console.warn('Cannot speak when not connected. Call connect() first.');
      return;
    }

    this.sendEvent(CLIENT_EVENTS.commentaryAppend, { delegation_id: null, content: input });
  }

  /**
   * Reports the result of a client delegation so the model can speak it. Only
   * for `client` delegation; `delegationId` comes from the `delegation` event.
   */
  sendDelegationResult(delegationId: string, content: string): void {
    if (this.state !== 'open') {
      console.warn('Cannot send a delegation result when not connected.');
      return;
    }
    this.sendEvent(CLIENT_EVENTS.commentaryAppend, { delegation_id: delegationId, content });
  }

  /**
   * `listen` is not supported as a discrete call on the Live API; transcripts
   * arrive as `writing` events during a session. Provided for contract
   * completeness.
   */
  async listen(): Promise<void> {
    this.logger.debug('listen is not supported by OpenAI Live; use connect + send and the writing event');
  }

  private waitForHandshake(event: 'open' | typeof SERVER_EVENTS.sessionStarted, timeoutMs: number): Promise<void> {
    const ws = this.ws;
    const signal = this.connectionAbort?.signal;
    return new Promise((resolve, reject) => {
      if (!ws) {
        reject(new Error('WebSocket not initialized'));
        return;
      }
      if (signal?.aborted) {
        reject(signal.reason);
        return;
      }
      if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
        reject(new Error('OpenAI Live WebSocket is closed'));
        return;
      }
      if (event === 'open' && ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      const cleanup = () => {
        clearTimeout(timer);
        ws.removeListener('open', onReady);
        ws.removeListener('error', onError);
        ws.removeListener('close', onClose);
        this.client.removeListener(SERVER_EVENTS.sessionStarted, onReady);
        this.client.removeListener(SERVER_EVENTS.error, onProtocolError);
        signal?.removeEventListener('abort', onAbort);
      };
      const onReady = () => {
        cleanup();
        resolve();
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const onClose = (code: number, reason: Buffer) =>
        onError(new Error(`OpenAI Live WebSocket closed during handshake (${code}: ${reason?.toString() ?? ''})`));
      const onProtocolError = (ev: any) =>
        onError(new Error(ev?.error?.message ?? 'OpenAI Live protocol error', { cause: ev?.error }));
      const onAbort = () => onError(signal!.reason);
      const timer = setTimeout(
        () => onError(new Error(`OpenAI Live connection timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );

      if (event === 'open') ws.once('open', onReady);
      else this.client.once(SERVER_EVENTS.sessionStarted, onReady);
      ws.once('error', onError);
      ws.once('close', onClose);
      this.client.once(SERVER_EVENTS.error, onProtocolError);
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  on(event: string, callback: EventCallback): void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

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

  /** Builds the `session.start` configuration. */
  private buildSessionConfig(): Record<string, unknown> {
    return {
      model: this.liveOptions.model || DEFAULT_MODEL,
      ...(this.instructions ? { instructions: this.instructions } : {}),
      audio: { format: { ...AUDIO_FORMAT }, output: { voice: this.speaker } },
      delegation: this.buildDelegation(),
      ...this.sessionConfig,
    };
  }

  /**
   * Builds a fresh delegation object from the current tools and config. The
   * caller's delegation object is never modified, so later `addTools` calls
   * advertise the new list.
   */
  private buildDelegation(): OpenAILiveDelegationConfig {
    const transformed = transformTools(this.tools);
    this.toolExecutors = new Map(transformed.map(t => [t.liveTool.name, t.execute]));

    const configured = this.delegation ?? { type: DELEGATION_MODES.responses };
    if (configured.type !== DELEGATION_MODES.responses) {
      return { ...configured };
    }
    const liveTools = transformed.map(t => t.liveTool);
    const responses = { model: DEFAULT_DELEGATION_MODEL, ...configured.responses };
    if (liveTools.length > 0) responses.tools = liveTools;
    return { ...configured, responses };
  }

  /** Sends the complete delegation object; GPT-Live replaces delegation as a whole. */
  private sendDelegationUpdate(): void {
    const delegation = this.buildDelegation();
    if (delegation.type !== DELEGATION_MODES.responses) return;
    this.sendEvent(CLIENT_EVENTS.sessionUpdate, { session: { delegation } });
  }

  private endSpeakerStream(): void {
    this.speakerStream?.end();
    this.speakerStream = undefined;
  }

  private setupEventListeners(): void {
    if (!this.ws) {
      throw new Error('WebSocket not initialized');
    }

    const ws = this.ws;
    ws.on('error', error => {
      if (this.ws === ws) this.emit('error', error);
    });
    ws.on('close', () => {
      if (this.ws === ws) {
        this.endSpeakerStream();
        this.state = 'close';
      }
    });
    ws.on('message', message => {
      if (this.ws !== ws) return;
      let data: any;
      try {
        data = JSON.parse(message.toString());
      } catch (err) {
        this.emit('error', new Error('Failed to parse OpenAI Live message', { cause: err }));
        return;
      }
      this.client.emit(data.type, data);

      if (this.debug) {
        const { delta, ...fields } = data;
        console.info(data.type, fields, delta?.length < 100 ? delta : '');
      }
    });

    this.client.on(SERVER_EVENTS.sessionStarted, ev => {
      this.emit('session.started', ev);
    });
    this.client.on(SERVER_EVENTS.sessionUpdated, ev => {
      this.emit('session.updated', ev);
    });
    this.client.on(SERVER_EVENTS.sessionClosed, ev => {
      this.endSpeakerStream();
      this.emit('session.closed', ev);
    });

    // Output audio has no done event, so one speaker stream lasts for the session.
    this.client.on(SERVER_EVENTS.outputAudioDelta, (ev: any) => {
      if (!ev?.delta) return;
      const audio = Buffer.from(ev.delta, 'base64');
      this.emit('speaking', { audio, start_ms: ev.start_ms, end_ms: ev.end_ms });

      if (!this.speakerStream) {
        const stream = new PassThrough() as StreamWithId;
        stream.id = 'default';
        this.speakerStream = stream;
        this.emit('speaker', stream);
      }
      this.speakerStream.write(audio);
    });

    this.client.on(SERVER_EVENTS.inputTranscriptDelta, (ev: any) => {
      this.emit('writing', { text: ev.delta, role: 'user', start_ms: ev.start_ms, end_ms: ev.end_ms });
    });
    this.client.on(SERVER_EVENTS.outputTranscriptDelta, (ev: any) => {
      this.emit('writing', { text: ev.delta, role: 'assistant', start_ms: ev.start_ms, end_ms: ev.end_ms });
    });

    this.client.on(SERVER_EVENTS.delegationCreated, (ev: any) => {
      const delegation = ev?.delegation;
      if (!delegation?.id) return;
      if (delegation.target === DELEGATION_MODES.client) {
        // Recommended right away so the model doesn't wait on an acknowledgement.
        this.sendEvent(CLIENT_EVENTS.thinkingAppend, { delegation_id: delegation.id, content: '' });
      }
      this.emit('delegation', { delegationId: delegation.id, target: delegation.target, offsetMs: ev.offset_ms });
    });

    this.client.on(SERVER_EVENTS.responseEvent, (ev: any) => {
      void this.handleResponseEvent(ev);
    });

    this.client.on(SERVER_EVENTS.error, ev => {
      this.emit('error', ev);
    });
  }

  /**
   * Handles a nested Responses event under `responses` delegation. Function calls
   * are answered with `response.item.create`; once the backend response completes
   * and every result is submitted, `response.create` continues it.
   */
  private async handleResponseEvent(envelope: any) {
    const delegationId: string | undefined = envelope?.delegation_id;
    const event = envelope?.event;
    if (!event || !delegationId) return;

    if (event.type === RESPONSE_EVENTS.outputItemDone && event.item?.type === 'function_call') {
      const pending = this.pendingToolCalls.get(delegationId) ?? [];
      pending.push(this.runToolCall(delegationId, event.item));
      this.pendingToolCalls.set(delegationId, pending);
      return;
    }

    if (event.type === RESPONSE_EVENTS.completed) {
      const pending = this.pendingToolCalls.get(delegationId);
      if (!pending?.length) return;
      this.pendingToolCalls.delete(delegationId);
      await Promise.all(pending);
      if (this.state === 'open') this.sendEvent(CLIENT_EVENTS.responseCreate, {});
    }
  }

  private async runToolCall(delegationId: string, item: any): Promise<void> {
    const name: string | undefined = item?.name;
    const callId: string | undefined = item?.call_id;
    if (!callId) return;
    let output: unknown;
    try {
      const args = typeof item.arguments === 'string' ? JSON.parse(item.arguments || '{}') : (item.arguments ?? {});
      const execute = name ? this.toolExecutors.get(name) : undefined;
      const tool = name ? this.tools?.[name] : undefined;
      if (!execute) {
        output = { error: `Tool "${name}" not found` };
      } else {
        this.emit('tool-call-start', {
          toolCallId: callId,
          toolName: name,
          toolDescription: tool?.description,
          args,
          delegationId,
        });
        const result = await execute(args);
        this.emit('tool-call-result', {
          toolCallId: callId,
          toolName: name,
          toolDescription: tool?.description,
          args,
          result,
          delegationId,
        });
        output = result;
      }
    } catch (e) {
      const err = e as Error;
      console.warn(`Error calling tool "${name}":`, err.message);
      output = { error: err.message };
    }

    if (this.state !== 'open') return;
    this.sendEvent(CLIENT_EVENTS.responseItemCreate, {
      item: { type: 'function_call_output', call_id: callId, output: JSON.stringify(output ?? null) },
    });
  }

  private int16ArrayToBase64(int16Array: Int16Array): string {
    return Buffer.from(int16Array.buffer, int16Array.byteOffset, int16Array.byteLength).toString('base64');
  }

  private sendEvent(type: string, data: Record<string, unknown>) {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      // Nothing is queued: an event for a closed session must not leak into the next one.
      this.emit('error', new Error(`OpenAI Live session is not open; dropped ${type}`));
      return;
    }
    ws.send(JSON.stringify({ type, ...data }));
  }
}
