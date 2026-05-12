import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { ToolsInput } from '@mastra/core/agent';
import type { RequestContext } from '@mastra/core/request-context';
import { MastraVoice } from '@mastra/core/voice';
import { WebSocket } from 'ws';
import type { InworldSessionConfig } from './types';
import { isReadableStream, transformTools } from './utils';

type EventCallback = (...args: any[]) => void;

type StreamWithId = PassThrough & { id: string };

type EventMap = {
  transcribing: [{ text: string }];
  writing: [{ text: string }];
  speaking: [{ audio: string }];
  speaker: [StreamWithId];
  error: [Error];
} & {
  [key: string]: EventCallback[];
};

/**
 * Default voice for Inworld TTS-2. Inworld ships a curated voice catalog; the
 * authoritative list comes from `getSpeakers()`.
 */
const DEFAULT_VOICE = 'Dennis';

const DEFAULT_URL = 'wss://api.inworld.ai/api/v1/realtime/session';

/**
 * Default realtime model. Inworld routes via an LLM Router; `anthropic/...`
 * model IDs are accepted directly.
 */
const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-6';

/**
 * Curated voice list, mirroring how `@mastra/voice-openai-realtime` ships a
 * static array. Inworld accepts any voice ID from its catalog at runtime;
 * extend or fetch dynamically via `getSpeakers()`.
 */
const VOICES = ['Dennis', 'Hades', 'Wendy', 'Edward', 'Olivia', 'Sarah', 'Timothy', 'Priya', 'Ronald', 'Deborah'];

type TTools = ToolsInput;

/**
 * InworldRealtimeVoice provides real-time voice interaction over Inworld's
 * Realtime API. Wire protocol is the OpenAI Realtime GA spec — same event
 * names on both sides (`conversation.item.added`, `conversation.item.done`,
 * `response.output_audio.delta`, etc.). Provider-level differences are the
 * endpoint, Basic auth, and Inworld-specific knobs surfaced via
 * `providerData`.
 *
 * Auth: Inworld API keys are already Basic-encoded — they are passed
 * verbatim in the `Authorization: Basic ...` header (do NOT re-encode).
 *
 * @example
 * ```typescript
 * const voice = new InworldRealtimeVoice({
 *   apiKey: process.env.INWORLD_API_KEY,
 *   model: 'anthropic/claude-sonnet-4-6',
 *   speaker: 'Dennis',
 * });
 *
 * await voice.connect();
 * voice.on('speaking', ({ audio }) => { /* play audio *\/ });
 * await voice.speak('Hello from Mastra!');
 * ```
 */
export class InworldRealtimeVoice extends MastraVoice {
  private ws?: WebSocket;
  private state: 'close' | 'open';
  private client: EventEmitter;
  private events: EventMap;
  private instructions?: string;
  private tools?: TTools;
  private debug: boolean;
  private queue: unknown[] = [];
  private requestContext?: RequestContext;
  private providerData?: Record<string, unknown>;

  constructor(
    private options: {
      model?: string;
      url?: string;
      apiKey?: string;
      speaker?: string;
      debug?: boolean;
      /**
       * Inworld-specific extensions (voice presets, semantic-VAD eagerness,
       * MCP tool_choice, etc.). Shallow-merged into the `session` object on
       * every `session.update` sent by this client.
       */
      providerData?: Record<string, unknown>;
    } = {},
  ) {
    super();

    this.client = new EventEmitter();
    this.state = 'close';
    this.events = {} as EventMap;
    this.speaker = options.speaker || DEFAULT_VOICE;
    this.debug = options.debug || false;
    this.providerData = options.providerData;
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

    if (options?.speaker) {
      this.updateConfig({ audio: { output: { voice: options.speaker } } });
    }

    this.sendEvent('conversation.item.create', {
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: input }],
      },
    });
    this.sendEvent('response.create', {
      response: {
        instructions: `Repeat the following text: ${input}`,
      },
    });
  }

  /**
   * Apply a new session config. Inworld-specific knobs travel through
   * `providerData`, which is shallow-merged from the constructor option.
   */
  updateConfig(sessionConfig: InworldSessionConfig | Record<string, unknown>): void {
    const merged = this.providerData ? { ...sessionConfig, ...this.providerData } : sessionConfig;
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

  waitForOpen() {
    return new Promise(resolve => {
      this.ws?.on('open', resolve);
    });
  }

  /**
   * Resolves on the first `session.updated` event. Inworld emits
   * `session.created` immediately on connect (despite older docs claiming
   * otherwise), but `session.updated` is the canonical handshake completion
   * because our `connect()` sends a `session.update` before declaring ready.
   */
  waitForSessionCreated() {
    return new Promise(resolve => {
      this.client.once('session.updated', resolve);
    });
  }

  /**
   * Open the websocket, send the initial `session.update`, and wait for
   * `session.updated`. Inworld accepts Basic-encoded API keys verbatim.
   */
  async connect({ requestContext }: { requestContext?: RequestContext } = {}) {
    const baseUrl = this.options.url || DEFAULT_URL;
    const url = this.options.model
      ? `${baseUrl}?model=${encodeURIComponent(this.options.model)}`
      : `${baseUrl}?model=${encodeURIComponent(DEFAULT_MODEL)}`;
    const apiKey = this.options.apiKey || process.env.INWORLD_API_KEY;
    this.requestContext = requestContext;

    this.ws = new WebSocket(url, undefined, {
      headers: {
        // Inworld API keys are pre-Basic-encoded; pass verbatim.
        Authorization: 'Basic ' + apiKey,
      },
    });

    this.setupEventListeners();

    const opened = this.waitForOpen();
    const ready = this.waitForSessionCreated();
    await opened;

    const inworldTools = transformTools(this.tools);
    this.updateConfig({
      model: this.options.model || DEFAULT_MODEL,
      instructions: this.instructions,
      tools: inworldTools.map(t => t.inworldTool),
      audio: { output: { voice: this.speaker } },
    });

    await ready;
    this.state = 'open';
  }

  disconnect() {
    this.state = 'close';
    this.ws?.close();
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

  private setupEventListeners(): void {
    const speakerStreams = new Map<string, StreamWithId>();
    const functionCallArgs = new Map<string, string>();

    if (!this.ws) {
      throw new Error('WebSocket not initialized');
    }

    this.ws.on('message', message => {
      const data = JSON.parse(message.toString());
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

      const queue = this.queue.splice(0, this.queue.length);
      for (const queued of queue) {
        this.ws?.send(JSON.stringify(queued));
      }
    });

    this.client.on('response.created', ev => {
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

    this.client.on('response.output_audio_transcript.delta', ev => {
      this.emit('writing', { text: ev.delta, response_id: ev.response_id, role: 'assistant' });
    });
    this.client.on('response.output_audio_transcript.done', ev => {
      this.emit('writing', { text: '\n', response_id: ev.response_id, role: 'assistant' });
    });

    this.client.on('response.output_text.delta', ev => {
      this.emit('writing', { text: ev.delta, response_id: ev.response_id, role: 'assistant' });
    });
    this.client.on('response.output_text.done', ev => {
      this.emit('writing', { text: '\n', response_id: ev.response_id, role: 'assistant' });
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

    this.client.on('response.done', async ev => {
      await this.handleFunctionCalls(ev);
      this.emit('response.done', ev);
      speakerStreams.delete(ev.response.id);
    });

    this.client.on('error', async ev => {
      this.emit('error', ev);
    });
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
      const context = JSON.parse(output.arguments);
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

export type { InworldSessionConfig } from './types';
