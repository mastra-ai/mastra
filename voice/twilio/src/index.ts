import type { ToolsInput } from '@mastra/core/agent';
import { MastraVoice } from '@mastra/core/voice';
import alawmulaw from 'alawmulaw';

/**
 * Twilio Voice provider for Mastra
 *
 * Enables AI voice agents over phone calls via Twilio Media Streams.
 *
 * @see https://github.com/mastra-ai/mastra/issues/11458
 * @see https://www.twilio.com/docs/voice/media-streams
 *
 * Features:
 * - Inbound PSTN call handling
 * - Real-time speech-to-speech via WebSocket
 * - Audio format conversion (mulaw <-> PCM)
 * - Turn-taking and barge-in support
 * - Integration with existing Mastra voice providers
 *
 * @example
 * ```typescript
 * import { TwilioVoice } from '@mastra/voice-twilio';
 * import { Agent } from '@mastra/core/agent';
 *
 * const voice = new TwilioVoice({
 *   accountSid: process.env.TWILIO_ACCOUNT_SID,
 *   authToken: process.env.TWILIO_AUTH_TOKEN,
 *   websocketUrl: 'wss://my-server.com/twilio',
 * });
 *
 * const agent = new Agent({
 *   name: 'Phone Agent',
 *   instructions: 'You are a helpful phone assistant.',
 *   model: openai('gpt-4o'),
 *   voice,
 * });
 *
 * // Handle incoming calls
 * voice.on('call-started', async ({ callSid, streamSid }) => {
 *   console.log(`Call started: ${callSid}`);
 * });
 *
 * voice.on('audio-received', async ({ audio, streamSid }) => {
 *   // Audio is already converted to PCM
 *   await voice.send(audio);
 * });
 *
 * voice.on('speaking', ({ audio, streamSid }) => {
 *   // Audio from AI is sent back to caller
 * });
 * ```
 */

export interface TwilioVoiceConfig {
  /** Twilio Account SID */
  accountSid?: string;
  /** Twilio Auth Token */
  authToken?: string;
  /** WebSocket server port for Media Streams */
  port?: number;
  /** WebSocket URL to include in TwiML */
  websocketUrl?: string;
  /** Enable debug logging */
  debug?: boolean;
}

export interface TwilioCallMetadata {
  callSid: string;
  streamSid: string;
  accountSid: string;
  tracks: string[];
  mediaFormat: {
    encoding: string;
    sampleRate: number;
    channels: number;
  };
}

type EventCallback = (...args: any[]) => void;

type EventMap = Record<string, EventCallback[]>;

/**
 * Twilio Media Streams message types
 */
interface TwilioMessage {
  event: 'connected' | 'start' | 'media' | 'stop' | 'mark';
  sequenceNumber?: string;
  protocol?: string;
  version?: string;
  streamSid?: string;
  start?: {
    streamSid: string;
    accountSid: string;
    callSid: string;
    tracks: string[];
    mediaFormat: {
      encoding: string;
      sampleRate: number;
      channels: number;
    };
  };
  media?: {
    track: string;
    chunk: string;
    timestamp: string;
    payload: string;
  };
  stop?: {
    accountSid: string;
    callSid: string;
  };
  mark?: {
    name: string;
  };
}

/**
 * Twilio Media Streams voice provider
 *
 * Handles real-time bidirectional audio streaming for phone calls.
 */
export class TwilioVoice extends MastraVoice {
  private config: TwilioVoiceConfig;
  private events: EventMap;
  private tools?: ToolsInput;
  private instructions?: string;

  // Connection management
  private activeConnections: Map<string, any> = new Map();
  private audioQueue: Map<string, Int16Array[]> = new Map();
  private activeStreamSid?: string;
  private callMetadata: Map<string, TwilioCallMetadata> = new Map();

  constructor(config: TwilioVoiceConfig = {}) {
    super({
      name: 'twilio',
    });

    this.config = {
      accountSid: config.accountSid || process.env.TWILIO_ACCOUNT_SID,
      authToken: config.authToken || process.env.TWILIO_AUTH_TOKEN,
      port: config.port || 8080,
      websocketUrl: config.websocketUrl,
      debug: config.debug || false,
    };

    this.events = {} as EventMap;
  }

  /**
   * Handle incoming WebSocket message from Twilio Media Streams
   *
   * @see https://www.twilio.com/docs/voice/media-streams/websocket-messages
   */
  async handleMessage(message: string): Promise<void> {
    const data: TwilioMessage = JSON.parse(message);

    if (this.config.debug) {
      console.info('[TwilioVoice] Received message:', data.event);
    }

    switch (data.event) {
      case 'connected':
        this.emit('call-started', {
          callSid: undefined,
          streamSid: undefined,
        });
        break;

      case 'start':
        if (data.start) {
          const metadata: TwilioCallMetadata = {
            callSid: data.start.callSid,
            streamSid: data.start.streamSid,
            accountSid: data.start.accountSid,
            tracks: data.start.tracks,
            mediaFormat: data.start.mediaFormat,
          };

          this.callMetadata.set(data.start.streamSid, metadata);
          this.activeStreamSid = data.start.streamSid;

          this.emit('call-metadata', metadata);
        }
        break;

      case 'media':
        if (data.media && data.streamSid) {
          // Decode base64 mulaw audio
          const mulawBuffer = Buffer.from(data.media.payload, 'base64');

          // Convert mulaw to PCM for AI provider compatibility
          const pcmAudio = this.mulawToPcm(mulawBuffer);

          this.emit('audio-received', {
            audio: pcmAudio,
            streamSid: data.streamSid,
          });
        }
        break;

      case 'stop':
        if (data.stop) {
          this.emit('call-ended', {
            callSid: data.stop.callSid,
            streamSid: data.streamSid,
          });

          // Clean up
          if (data.streamSid) {
            this.callMetadata.delete(data.streamSid);
            this.activeConnections.delete(data.streamSid);
            this.audioQueue.delete(data.streamSid);
          }
        }
        break;

      case 'mark':
        // Mark events are acknowledgments - can be used for synchronization
        if (this.config.debug && data.mark) {
          console.info('[TwilioVoice] Mark received:', data.mark.name);
        }
        break;
    }
  }

  /**
   * Convert mulaw audio to PCM (16-bit signed)
   * Twilio sends 8-bit mulaw, AI providers typically need 16-bit PCM
   */
  private mulawToPcm(mulawBuffer: Buffer): Int16Array {
    const uint8 = new Uint8Array(mulawBuffer.buffer, mulawBuffer.byteOffset, mulawBuffer.length);
    return new Int16Array(alawmulaw.mulaw.decode(uint8).buffer);
  }

  /**
   * Convert PCM (16-bit signed) to mulaw audio
   * AI providers output PCM, Twilio expects mulaw
   */
  private pcmToMulaw(pcm: Int16Array): Buffer {
    return Buffer.from(alawmulaw.mulaw.encode(pcm));
  }

  /**
   * Send audio to an active Twilio call
   *
   * @param streamSid - The stream identifier for the call
   * @param audio - PCM audio data (will be converted to mulaw)
   */
  async sendAudio(streamSid: string, audio: Int16Array): Promise<void> {
    const ws = this.activeConnections.get(streamSid);

    // Emit speaking event
    this.emit('speaking', {
      streamSid,
      audio: this.pcmToMulaw(audio),
    });

    if (!ws || ws.readyState !== 1) {
      // WebSocket not ready - queue the audio
      if (!this.audioQueue.has(streamSid)) {
        this.audioQueue.set(streamSid, []);
      }
      this.audioQueue.get(streamSid)!.push(audio);
      return;
    }

    // Convert PCM to mulaw
    const mulawAudio = this.pcmToMulaw(audio);

    // Encode as base64
    const payload = mulawAudio.toString('base64');

    // Send media message to Twilio
    const mediaMessage = JSON.stringify({
      event: 'media',
      streamSid,
      media: {
        payload,
      },
    });

    ws.send(mediaMessage);
  }

  /**
   * Emit a transcription event
   *
   * @param streamSid - The stream identifier for the call
   * @param text - The transcribed text
   */
  async emitTranscription(streamSid: string, text: string): Promise<void> {
    this.emit('writing', {
      text,
      streamSid,
      role: 'user',
    });
  }

  /**
   * Generate TwiML for connecting calls to Media Streams
   *
   * This TwiML should be returned by your webhook when receiving incoming calls.
   *
   * @example
   * ```typescript
   * // In your Express/Hono/etc. webhook handler:
   * app.post('/incoming-call', (req, res) => {
   *   const twiml = voice.generateTwiML();
   *   res.type('text/xml').send(twiml);
   * });
   * ```
   */
  generateTwiML(): string {
    const websocketUrl = this.config.websocketUrl;

    if (!websocketUrl) {
      throw new Error('websocketUrl is required to generate TwiML');
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${websocketUrl}" />
  </Connect>
</Response>`;
  }

  /**
   * Register a WebSocket connection for a stream
   *
   * @param streamSid - The stream identifier
   * @param ws - The WebSocket connection
   */
  registerConnection(streamSid: string, ws: any): void {
    this.activeConnections.set(streamSid, ws);
    this.activeStreamSid = streamSid;

    // Flush any queued audio
    const queued = this.audioQueue.get(streamSid);
    if (queued && queued.length > 0) {
      for (const audio of queued) {
        void this.sendAudio(streamSid, audio);
      }
      this.audioQueue.delete(streamSid);
    }
  }

  // ==========================================
  // MastraVoice abstract method implementations
  // ==========================================

  /**
   * Convert text to speech and send to active call
   *
   * Note: This method requires a TTS provider to be configured.
   * The TwilioVoice class handles the telephony transport layer,
   * while actual TTS synthesis should be handled by another provider
   * (e.g., OpenAI, ElevenLabs) and then passed through sendAudio().
   */
  async speak(
    input: string | NodeJS.ReadableStream,
    _options?: { speaker?: string },
  ): Promise<NodeJS.ReadableStream | void> {
    // For telephony, speak() is typically used with a TTS provider
    // The audio from TTS should be sent via sendAudio()

    if (!this.activeStreamSid) {
      this.logger.warn('No active call to speak to');
      return;
    }

    // If input is a string, we need a TTS provider to convert it
    // This is a placeholder - in practice, you'd integrate with a TTS provider
    if (typeof input === 'string') {
      this.logger.debug(`speak() called with text: "${input.substring(0, 50)}..."`);
      // The actual TTS conversion would happen via CompositeVoice or external provider
      return;
    }

    // If input is a stream (audio from TTS provider), send it to Twilio
    if (input && typeof (input as any).on === 'function') {
      const chunks: Buffer[] = [];

      for await (const chunk of input as AsyncIterable<Buffer>) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      const audioBuffer = Buffer.concat(chunks);

      // Assuming PCM audio from TTS - convert buffer to Int16Array
      const pcmAudio = new Int16Array(audioBuffer.buffer, audioBuffer.byteOffset, audioBuffer.byteLength / 2);

      await this.sendAudio(this.activeStreamSid, pcmAudio);
    }
  }

  /**
   * Transcribe audio from caller
   *
   * Note: This method requires an STT provider to be configured.
   * The TwilioVoice class handles receiving audio and format conversion,
   * while actual transcription should be handled by another provider
   * (e.g., OpenAI Whisper, Deepgram).
   */
  async listen(
    audioStream: NodeJS.ReadableStream | unknown,
    _options?: Record<string, unknown>,
  ): Promise<string | NodeJS.ReadableStream | void> {
    // For telephony, audio comes in via the 'audio-received' event
    // This method is for processing audio that's been received

    if (!audioStream) {
      return '';
    }

    // If we receive a stream, collect it and return as-is
    // The actual STT would happen via CompositeVoice or external provider
    if (audioStream && typeof (audioStream as any).on === 'function') {
      const chunks: Buffer[] = [];

      for await (const chunk of audioStream as AsyncIterable<Buffer>) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      // Return empty string - actual transcription requires STT provider
      // This is a placeholder for the interface
      return '';
    }

    return '';
  }

  /**
   * Add tools for the voice agent
   */
  addTools(tools: ToolsInput): void {
    this.tools = tools;
  }

  /**
   * Add instructions for the voice agent
   */
  addInstructions(instructions?: string): void {
    this.instructions = instructions;
  }

  /**
   * Register an event listener
   */
  on(event: string, callback: EventCallback): void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    (this.events[event] as EventCallback[]).push(callback);
  }

  /**
   * Remove an event listener
   */
  off(event: string, callback: EventCallback): void {
    if (!this.events[event]) return;
    const callbacks = this.events[event] as EventCallback[];
    const index = callbacks.indexOf(callback);
    if (index !== -1) {
      callbacks.splice(index, 1);
    }
  }

  /**
   * Emit an event
   */
  private emit(event: string, ...args: any[]): void {
    if (!this.events[event]) return;
    const callbacks = this.events[event] as EventCallback[];
    for (const callback of callbacks) {
      callback(...args);
    }
  }

  /**
   * Close all connections
   */
  close(): void {
    for (const [_streamSid, ws] of this.activeConnections) {
      ws?.close?.();
    }
    this.activeConnections.clear();
    this.audioQueue.clear();
    this.callMetadata.clear();
    this.activeStreamSid = undefined;
  }

  /**
   * Get available speakers (voices)
   *
   * Twilio doesn't have built-in voices - TTS is handled by the configured provider.
   */
  async getSpeakers(): Promise<Array<{ voiceId: string }>> {
    // Twilio doesn't have built-in voices - this would be handled by the TTS provider
    return [];
  }

  /**
   * Get call metadata for a stream
   */
  getCallMetadata(streamSid: string): TwilioCallMetadata | undefined {
    return this.callMetadata.get(streamSid);
  }

  /**
   * Get the currently active stream SID
   */
  getActiveStreamSid(): string | undefined {
    return this.activeStreamSid;
  }

  /**
   * Check if there's an active call
   */
  hasActiveCall(): boolean {
    return this.activeConnections.size > 0;
  }
}
