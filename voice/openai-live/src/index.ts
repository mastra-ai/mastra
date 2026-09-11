import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { ToolsInput } from '@internal/voice';
import { MastraVoice } from '@internal/voice';
import { WebSocket } from 'ws';
import {
  CLIENT_EVENTS,
  DEFAULT_DELEGATION_MODEL,
  DEFAULT_MODEL,
  DEFAULT_USER_AGENT,
  DEFAULT_VOICE,
  DELEGATION_MODES,
  LIVE_FIELDS,
  LIVE_WS_URL,
  SERVER_EVENTS,
  VOICES,
} from './protocol';
import { isReadableStream, transformTools } from './utils';

type EventCallback = (...args: any[]) => void;

type StreamWithId = PassThrough & { id: string };

type TTools = ToolsInput;

/**
 * Delegation configuration passed through to the Live session. GPT-Live
 * delegates reasoning/tools to a backend model (e.g. a Responses model). The
 * shape is provider-defined and forwarded verbatim in the session config.
 */
export interface OpenAILiveDelegationConfig {
  type: 'responses' | string;
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
  /** Extra session config merged into the session.update payload. */
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
  private queue: unknown[] = [];
  private connectionAbort?: AbortController;

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
   * Equips the session with instructions. Applied on connect, or immediately if
   * already connected.
   */
  addInstructions(instructions?: string) {
    this.instructions = instructions;
    if (this.state === 'open') this.sendSessionUpdate();
  }

  /**
   * Equips the session with tools. Applied on connect, or immediately if already
   * connected.
   */
  addTools(tools?: TTools) {
    this.tools = tools || {};
    if (this.state === 'open') this.sendSessionUpdate();
  }

  /**
   * Updates the session configuration, merged into subsequent session updates.
   */
  updateConfig(sessionConfig: Record<string, unknown>): void {
    this.sessionConfig = { ...this.sessionConfig, ...sessionConfig };
    if (this.state === 'open') this.sendSessionUpdate();
  }

  /**
   * Establishes a connection to the OpenAI Live session. Must be called before
   * `send` or `speak`.
   */
  async connect({ timeout }: { timeout?: number } = {}): Promise<void> {
    const url = this.liveOptions.url || LIVE_WS_URL;
    const apiKey = this.liveOptions.apiKey || process.env.OPENAI_API_KEY;

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

    try {
      await Promise.all([this.waitForOpen(), this.waitForSessionReady(timeout)]);
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
    this.sendSessionUpdate();
  }

  disconnect() {
    this.state = 'close';
    this.connectionAbort?.abort(new Error('OpenAI Live connection disconnected during handshake'));
    this.ws?.close();
  }

  /**
   * Disconnects from the Live session and cleans up resources.
   */
  close() {
    if (!this.ws) return;
    if (this.state === 'open' && this.ws.readyState === this.ws.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: CLIENT_EVENTS.sessionClose }));
      } catch {
        // best-effort; the socket is being torn down regardless
      }
    }
    this.ws.close();
    this.state = 'close';
    this.ws = undefined;
  }

  /**
   * Streams audio data to the Live session. Accepts a readable stream or an
   * Int16Array of PCM samples.
   */
  async send(audioData: NodeJS.ReadableStream | Int16Array): Promise<void> {
    if (this.state !== 'open') {
      console.warn('Cannot send audio when not connected. Call connect() first.');
      return;
    }

    if (isReadableStream(audioData)) {
      const stream = audioData as NodeJS.ReadableStream;
      stream.on('data', chunk => {
        try {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          this.sendEvent(CLIENT_EVENTS.inputAudioAppend, { [LIVE_FIELDS.audio]: buffer.toString('base64') });
        } catch (err) {
          this.emit('error', err);
        }
      });
    } else if (audioData instanceof Int16Array) {
      try {
        const base64Audio = this.int16ArrayToBase64(audioData);
        this.sendEvent(CLIENT_EVENTS.inputAudioAppend, { [LIVE_FIELDS.audio]: base64Audio });
      } catch (err) {
        this.emit('error', err);
      }
    } else {
      this.emit('error', new Error('Unsupported audio data format'));
    }
  }

  /**
   * Adds text to the spoken conversation as context and asks the model to speak.
   *
   * GPT-Live is server-driven: there is no `response.create` and no way to force
   * an exact utterance. This appends the text (plus an instruction to say it) via
   * `session.context.append`; the model decides when and how to speak. This is
   * commonly used to open a call with a greeting after `session.started`.
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

    this.sendEvent(CLIENT_EVENTS.sessionContextAppend, {
      context: `Say the following to the user now: ${input}`,
    });
  }

  /**
   * `listen` is not supported as a discrete call on the Live API — transcripts
   * arrive as `writing` events during a session. Provided for contract
   * completeness.
   */
  async listen(): Promise<void> {
    this.logger.debug('listen is not supported by OpenAI Live; use connect + send and the writing event');
  }

  waitForOpen(): Promise<void> {
    return this.waitForHandshake('open');
  }

  waitForSessionReady(timeout?: number): Promise<void> {
    return this.waitForHandshake('session.started', timeout);
  }

  private waitForHandshake(event: 'open' | 'session.started', timeout?: number): Promise<void> {
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
        onError(new Error(`OpenAI Live WebSocket closed during handshake (${code}: ${reason.toString()})`));
      const onProtocolError = (ev: any) =>
        onError(new Error(ev?.error?.message ?? 'OpenAI Live protocol error', { cause: ev?.error }));
      const onAbort = () => onError(signal!.reason);
      const timeoutMs = timeout ?? this.liveOptions.connectTimeoutMs ?? 15_000;
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

  private sendSessionUpdate() {
    const liveTools = transformTools(this.tools).map(t => t.liveTool);

    // GPT-Live delegates reasoning/tools to a backend under `responses`
    // delegation (the default). Tools live under `responses.tools`, and the
    // nested `responses` object requires its own backend `model`. Under
    // `client` delegation there is no tool channel, so tools are omitted.
    const delegation: OpenAILiveDelegationConfig = this.delegation ?? { type: DELEGATION_MODES.responses };
    if (delegation.type === DELEGATION_MODES.responses) {
      delegation.responses = {
        model: DEFAULT_DELEGATION_MODEL,
        ...delegation.responses,
        tools: delegation.responses?.tools ?? liveTools,
      };
    }

    this.updateSessionConfig({
      model: this.liveOptions.model || DEFAULT_MODEL,
      instructions: this.instructions,
      voice: this.speaker,
      delegation,
      ...this.sessionConfig,
    });
  }

  private updateSessionConfig(session: Record<string, unknown>): void {
    this.sendEvent(CLIENT_EVENTS.sessionUpdate, { session });
  }

  private setupEventListeners(): void {
    const speakerStreams = new Map<string, StreamWithId>();
    const DEFAULT_STREAM_ID = 'default';

    if (!this.ws) {
      throw new Error('WebSocket not initialized');
    }

    const ws = this.ws;
    ws.on('error', error => {
      if (this.ws === ws) this.emit('error', error);
    });
    ws.on('message', message => {
      if (this.ws !== ws) return;
      const data = JSON.parse(message.toString());
      this.client.emit(data.type, data);

      if (this.debug) {
        const { delta, ...fields } = data;
        console.info(data.type, fields, delta?.length < 100 ? delta : '');
      }
    });

    this.client.on(SERVER_EVENTS.sessionStarted, ev => {
      this.emit('session.started', ev);
      const queue = this.queue.splice(0, this.queue.length);
      for (const queued of queue) {
        this.ws?.send(JSON.stringify(queued));
      }
    });
    this.client.on(SERVER_EVENTS.sessionUpdated, ev => {
      this.emit('session.updated', ev);
    });

    this.client.on(SERVER_EVENTS.outputAudioDelta, (ev: any) => {
      const base64 = ev[LIVE_FIELDS.audio] ?? ev[LIVE_FIELDS.delta];
      if (!base64) return;
      const audio = Buffer.from(base64, 'base64');
      const id = ev.response_id ?? DEFAULT_STREAM_ID;
      this.emit('speaking', { audio });

      let stream = speakerStreams.get(id);
      if (!stream) {
        stream = new PassThrough() as StreamWithId;
        stream.id = id;
        speakerStreams.set(id, stream);
        this.emit('speaker', stream);
      }
      stream.write(audio);
    });
    this.client.on(SERVER_EVENTS.outputAudioDone, (ev: any) => {
      const id = ev.response_id ?? DEFAULT_STREAM_ID;
      this.emit('speaking.done', { response_id: id });
      const stream = speakerStreams.get(id);
      stream?.end();
      speakerStreams.delete(id);
    });

    this.client.on(SERVER_EVENTS.outputTranscriptDelta, (ev: any) => {
      this.emit('writing', { text: ev[LIVE_FIELDS.delta], role: 'assistant' });
    });
    this.client.on(SERVER_EVENTS.outputTranscriptDone, () => {
      this.emit('writing', { text: '\n', role: 'assistant' });
    });

    this.client.on(SERVER_EVENTS.delegationCreated, async (ev: any) => {
      await this.handleDelegation(ev);
    });

    this.client.on(SERVER_EVENTS.error, ev => {
      this.emit('error', ev);
    });
  }

  /**
   * Handle a `delegation.created` event by executing the requested tool and
   * returning its result via `delegation.function_call_output.create`. GPT-Live
   * is server-driven: there is NO follow-on `response.create` — the server
   * resumes the delegation on its own once the output is delivered.
   */
  private async handleDelegation(ev: any) {
    const delegationId = ev?.[LIVE_FIELDS.delegationId] ?? ev?.delegation?.[LIVE_FIELDS.delegationId] ?? ev?.id;
    const call = ev?.function_call ?? ev?.delegation?.function_call ?? ev;
    const name = call?.[LIVE_FIELDS.name];
    const rawArgs = call?.[LIVE_FIELDS.arguments];
    try {
      const context = typeof rawArgs === 'string' ? JSON.parse(rawArgs || '{}') : (rawArgs ?? {});
      const tool = name ? this.tools?.[name] : undefined;
      if (!tool) {
        console.warn(`Tool "${name}" not found`);
        return;
      }

      if (tool.execute) {
        this.emit('tool-call-start', {
          toolCallId: delegationId,
          toolName: name,
          toolDescription: tool.description,
          args: context,
        });
      }

      const result = await tool.execute?.(context, {
        toolCallId: delegationId,
        messages: [],
      });

      this.emit('tool-call-result', {
        toolCallId: delegationId,
        toolName: name,
        toolDescription: tool.description,
        args: context,
        result,
      });

      this.sendDelegationOutput(delegationId, JSON.stringify(result));
    } catch (e) {
      const err = e as Error;
      console.warn(`Error calling tool "${name}":`, err.message);
      this.sendDelegationOutput(delegationId, JSON.stringify({ error: err.message }));
    }
  }

  private sendDelegationOutput(delegationId: string, output: string): void {
    this.sendEvent(CLIENT_EVENTS.delegationFunctionCallOutputCreate, {
      [LIVE_FIELDS.delegationId]: delegationId,
      output,
    });
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
      this.queue.push({ type, ...data });
    } else {
      this.ws.send(
        JSON.stringify({
          type,
          ...data,
        }),
      );
    }
  }
}
