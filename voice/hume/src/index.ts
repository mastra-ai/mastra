import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';

import type { VoiceEventMap, VoiceEventType } from '@mastra/core/voice';
import { MastraVoice } from '@mastra/core/voice';
import { HumeClient } from 'hume';

interface HumeVoiceConfig {
  apiKey?: string;
}

/** EVI realtime connection options passed at connect() */
export interface HumeRealtimeConfig {
  /** EVI config ID (required for realtime). Create via Hume dashboard or API. */
  configId: string;
  /** Config version for pinned configs */
  configVersion?: string | number;
  /** Session overrides: system prompt, voice, etc. */
  sessionSettings?: {
    systemPrompt?: string;
    voiceId?: string;
    [key: string]: unknown;
  };
}

export class HumeVoice extends MastraVoice {
  private client: HumeClient;
  private apiKey: string;
  private storedSpeaker?: string;
  private realtimeConfig?: HumeRealtimeConfig;
  private eventEmitter = new EventEmitter();
  private socket: ReturnType<HumeClient['empathicVoice']['chat']['connect']> | null = null;
  private state: 'disconnected' | 'connected' = 'disconnected';

  constructor({
    speechModel,
    speaker,
    realtimeConfig,
  }: {
    speechModel?: HumeVoiceConfig;
    speaker?: string;
    realtimeConfig?: HumeRealtimeConfig;
  } = {}) {
    const apiKey = speechModel?.apiKey ?? process.env.HUME_API_KEY;

    super({
      speechModel: {
        name: 'hume',
        apiKey,
      },
      speaker,
    });

    if (!apiKey) {
      throw new Error('HUME_API_KEY is not set. Set it in environment variables or pass apiKey in speechModel config.');
    }

    this.apiKey = apiKey;
    this.client = new HumeClient({ apiKey });
    this.storedSpeaker = speaker;
    this.realtimeConfig = realtimeConfig;
  }

  /**
   * Retrieves a list of available voices from the Hume TTS API.
   * Includes both Hume Voice Library voices (HUME_AI) and custom voices (CUSTOM_VOICE).
   */
  async getSpeakers(): Promise<Array<{ voiceId: string; name?: string }>> {
    const voices: Array<{ voiceId: string; name?: string }> = [];
    const PAGE_SIZE = 100;

    for (const provider of ['HUME_AI', 'CUSTOM_VOICE'] as const) {
      try {
        let pageNumber = 0;
        let totalPages = 1;

        do {
          const page = await this.client.tts.voices.list({
            provider,
            pageNumber,
            pageSize: PAGE_SIZE,
          });
          const response = page.response as { totalPages?: number; voicesPage?: Array<{ id?: string; name?: string }> };
          totalPages = response.totalPages ?? 1;
          const items = response.voicesPage ?? page.data ?? [];

          for (const voice of items) {
            const id = voice.id ?? voice.name;
            if (id) {
              voices.push({
                voiceId: id,
                name: voice.name,
              });
            }
          }
          pageNumber++;
        } while (pageNumber < totalPages);
      } catch (err) {
        this.logger.warn(`Hume voices list failed for provider ${provider}:`, err);
        throw err;
      }
    }

    return voices;
  }

  private async streamToString(stream: NodeJS.ReadableStream): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      if (typeof chunk === 'string') {
        chunks.push(Buffer.from(chunk));
      } else {
        chunks.push(chunk);
      }
    }
    return Buffer.concat(chunks).toString('utf-8');
  }

  /**
   * Converts text to speech using Hume's TTS API.
   */
  async speak(
    input: string | NodeJS.ReadableStream,
    options?: {
      speaker?: string;
      format?: { type: 'mp3' | 'wav' | 'pcm' };
      description?: string;
      [key: string]: unknown;
    },
  ): Promise<NodeJS.ReadableStream> {
    const text = typeof input === 'string' ? input : await this.streamToString(input);

    if (text.trim().length === 0) {
      throw new Error('Input text is empty');
    }

    const speaker = options?.speaker ?? this.storedSpeaker;
    const voice = speaker ? { name: speaker } : undefined;

    const binaryBody = await this.client.tts.synthesizeFileStreaming({
      utterances: [{ text, voice, description: options?.description }],
      format: options?.format ?? { type: 'mp3' },
    });

    const webStream = binaryBody.stream();

    if (!webStream) {
      throw new Error('No stream returned from Hume TTS');
    }

    const nodeStream = Readable.fromWeb(webStream as globalThis.ReadableStream<Uint8Array>);

    return nodeStream;
  }

  /**
   * Checks if listening capabilities are enabled.
   */
  async getListener(): Promise<{ enabled: boolean }> {
    return { enabled: false };
  }

  /**
   * Hume does not support speech-to-text. Use CompositeVoice with another provider for STT.
   */
  async listen(
    _input: NodeJS.ReadableStream,
    _options?: Record<string, unknown>,
  ): Promise<string | NodeJS.ReadableStream> {
    throw new Error(
      'Hume does not support speech recognition. Use CompositeVoice with a provider like Deepgram for STT.',
    );
  }

  /**
   * Establishes a WebSocket connection to Hume EVI for realtime speech-to-speech.
   * Requires realtimeConfig.configId (create via Hume dashboard or API).
   *
   * @example
   * ```typescript
   * const voice = new HumeVoice({
   *   speechModel: { apiKey: process.env.HUME_API_KEY },
   *   realtimeConfig: { configId: 'your-evi-config-id' }
   * });
   * await voice.connect();
   * voice.on('speaking', ({ audio }) => { /* play base64 audio *\/ });
   * voice.on('writing', ({ text, role }) => { console.log(role, text); });
   * ```
   */
  async connect(options?: { realtimeConfig?: HumeRealtimeConfig }): Promise<void> {
    const config = options?.realtimeConfig ?? this.realtimeConfig;
    if (!config?.configId) {
      throw new Error(
        'Hume EVI realtime requires configId. Pass realtimeConfig: { configId: "..." } in constructor or connect({ realtimeConfig: { configId: "..." } }).',
      );
    }

    if (this.state === 'connected' && this.socket) {
      return;
    }

    const apiKey = this.apiKey;
    const sessionSettings = { ...(config.sessionSettings ?? {}) };
    if (this.storedSpeaker && !sessionSettings.voiceId) {
      sessionSettings.voiceId = this.storedSpeaker;
    }

    this.socket = this.client.empathicVoice.chat.connect({
      configId: config.configId,
      configVersion: config.configVersion,
      sessionSettings,
      apiKey,
    });

    this.socket.on('message', (msg: { type: string; [key: string]: unknown }) => {
      this.handleEviMessage(msg);
    });
    this.socket.on('error', (err: Error) => {
      this.emitEvent('error', { message: err.message, details: err });
    });
    this.socket.on('close', () => {
      this.state = 'disconnected';
      this.socket = null;
    });

    try {
      this.socket.connect();
      await this.socket.waitForOpen();
      this.state = 'connected';
    } catch (err) {
      this.socket.close();
      this.state = 'disconnected';
      this.socket = null;
      throw err;
    }
  }

  private handleEviMessage(msg: { type: string; [key: string]: unknown }): void {
    switch (msg.type) {
      case 'audio_output': {
        const data = msg.data as string | undefined;
        if (data) {
          this.emitEvent('speaking', { audio: data });
        }
        break;
      }
      case 'user_message': {
        const content = (msg.message as { content?: string })?.content;
        if (typeof content === 'string') {
          this.emitEvent('writing', { text: content, role: 'user' });
        }
        break;
      }
      case 'assistant_message': {
        const content = (msg.message as { content?: string })?.content;
        if (typeof content === 'string') {
          this.emitEvent('writing', { text: content, role: 'assistant' });
        }
        break;
      }
      case 'websocket_error': {
        const message = (msg as { message?: string }).message ?? 'Hume EVI WebSocket error';
        this.emitEvent('error', { message, code: 'websocket_error', details: msg });
        break;
      }
      default:
        break;
    }
  }

  private emitEvent<E extends keyof VoiceEventMap>(event: E, data: VoiceEventMap[E]): void {
    this.eventEmitter.emit(event, data);
  }

  /**
   * Streams audio to the EVI session. Expects PCM 16-bit audio.
   * For Int16Array, converts to base64 automatically.
   * For streams, sends each chunk as it arrives (recommended ~20ms chunks).
   */
  async send(audioData: NodeJS.ReadableStream | Int16Array): Promise<void> {
    if (this.state !== 'connected' || !this.socket) {
      throw new Error('Not connected. Call connect() first.');
    }

    if (audioData instanceof Int16Array) {
      const buffer = Buffer.from(audioData.buffer, audioData.byteOffset, audioData.byteLength);
      this.socket.sendAudioInput({ data: buffer.toString('base64') });
      return;
    }

    return new Promise((resolve, reject) => {
      const stream = audioData as NodeJS.ReadableStream;
      stream.on('data', (chunk: Buffer | Uint8Array) => {
        try {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          this.socket?.sendAudioInput({ data: buffer.toString('base64') });
        } catch (err) {
          if ('destroy' in stream && typeof (stream as { destroy?: () => void }).destroy === 'function') {
            (stream as { destroy: () => void }).destroy();
          }
          reject(err);
        }
      });
      stream.on('end', resolve);
      stream.on('error', reject);
    });
  }

  /**
   * Sends text to the assistant to speak. Triggers the assistant to respond with that text as speech.
   */
  async answer(options?: { text?: string }): Promise<void> {
    if (this.state !== 'connected' || !this.socket) {
      throw new Error('Not connected. Call connect() first.');
    }
    const text = options?.text ?? '';
    if (text) {
      this.socket.sendAssistantInput({ text });
    }
  }

  /**
   * Disconnects from the EVI WebSocket.
   */
  close(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.state = 'disconnected';
  }

  /**
   * Register an event listener. Events: 'speaking', 'writing', 'error'.
   */
  on<E extends VoiceEventType>(
    event: E,
    callback: (data: E extends keyof VoiceEventMap ? VoiceEventMap[E] : unknown) => void,
  ): void {
    this.eventEmitter.on(event as string, callback);
  }

  /**
   * Remove an event listener.
   */
  off<E extends VoiceEventType>(
    event: E,
    callback: (data: E extends keyof VoiceEventMap ? VoiceEventMap[E] : unknown) => void,
  ): void {
    this.eventEmitter.off(event as string, callback);
  }
}

export type { HumeVoiceConfig };
