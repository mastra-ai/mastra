/**
 * @mastra/voice-twilio
 *
 * Twilio Voice integration for Mastra telephony.
 * Provides WebSocket-based Media Streams support for real-time voice AI over phone calls.
 *
 * @example
 * ```typescript
 * import { TwilioVoice } from '@mastra/voice-twilio';
 * import { TelephonySession } from '@mastra/core/voice';
 * import { OpenAIRealtimeVoice } from '@mastra/voice-openai-realtime';
 *
 * const twilioVoice = new TwilioVoice();
 * const aiVoice = new OpenAIRealtimeVoice();
 *
 * const session = new TelephonySession({
 *   telephony: twilioVoice,
 *   ai: aiVoice,
 *   bargeIn: true,
 * });
 *
 * // In your WebSocket handler
 * wss.on('connection', (ws) => {
 *   twilioVoice.connect(ws);
 *   session.start();
 * });
 * ```
 */

import { MastraVoice, mulawToPcm, pcmToMulaw } from '@mastra/core/voice';
import type { WebSocket } from 'ws';

export { generateTwiML, twiml } from './twiml';

/**
 * Configuration options for TwilioVoice
 */
export interface TwilioVoiceConfig {
  /** Name for logging identification */
  name?: string;
}

/**
 * Twilio Media Streams message types
 */
interface TwilioMediaMessage {
  event: 'connected' | 'start' | 'media' | 'stop' | 'mark';
  sequenceNumber?: string;
  streamSid?: string;
  start?: {
    streamSid: string;
    accountSid: string;
    callSid: string;
    tracks: string[];
    customParameters: Record<string, string>;
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
 * Event callback type
 */
type EventCallback = (...args: unknown[]) => void;

/**
 * TwilioVoice - Twilio Media Streams integration for Mastra
 *
 * Handles the WebSocket connection to Twilio Media Streams, converting
 * between Twilio's μ-law audio format and PCM for AI providers.
 *
 * @extends MastraVoice
 *
 * @example
 * ```typescript
 * const twilioVoice = new TwilioVoice();
 *
 * // Connect to incoming WebSocket from Twilio
 * twilioVoice.connect(ws);
 *
 * // Listen for events
 * twilioVoice.on('call-started', ({ callSid, streamSid }) => {
 *   console.log(`Call ${callSid} connected`);
 * });
 *
 * twilioVoice.on('audio-received', ({ audio }) => {
 *   // audio is Int16Array PCM
 *   aiVoice.send(audio);
 * });
 * ```
 */
export class TwilioVoice extends MastraVoice {
  private ws?: WebSocket;
  private streamSid?: string;
  private callSid?: string;
  private handlers = new Map<string, Set<EventCallback>>();
  private audioQueue: Buffer[] = [];
  private isConnected = false;

  constructor(config: TwilioVoiceConfig = {}) {
    super({ name: config.name ?? 'twilio' });
  }

  /**
   * Connect to a Twilio Media Streams WebSocket
   *
   * @param ws - WebSocket connection from Twilio
   *
   * @example
   * ```typescript
   * wss.on('connection', (ws) => {
   *   twilioVoice.connect(ws);
   * });
   * ```
   */
  connect(ws: WebSocket): void {
    this.ws = ws;
    this.isConnected = true;

    ws.on('message', (data: Buffer) => {
      this.handleMessage(data.toString());
    });

    ws.on('close', () => {
      this.isConnected = false;
      this.emit('call-ended', { callSid: this.callSid });
    });

    ws.on('error', (error: Error) => {
      this.emit('error', error);
    });
  }

  /**
   * Handle incoming Twilio Media Streams messages
   */
  private handleMessage(message: string): void {
    let data: TwilioMediaMessage;
    try {
      data = JSON.parse(message);
    } catch {
      this.logger.warn('Failed to parse Twilio message', { message });
      return;
    }

    switch (data.event) {
      case 'connected':
        this.logger.debug('Twilio Media Streams connected');
        break;

      case 'start':
        this.streamSid = data.start?.streamSid;
        this.callSid = data.start?.callSid;
        this.logger.debug('Stream started', {
          streamSid: this.streamSid,
          callSid: this.callSid,
        });
        this.emit('call-started', {
          callSid: this.callSid,
          streamSid: this.streamSid,
        });
        break;

      case 'media':
        if (data.media?.payload) {
          // Decode base64 μ-law audio
          const mulawBuffer = Buffer.from(data.media.payload, 'base64');
          // Convert to PCM for AI providers
          const pcmAudio = mulawToPcm(mulawBuffer);
          this.emit('audio-received', {
            audio: pcmAudio,
            streamSid: this.streamSid,
          });
        }
        break;

      case 'stop':
        this.logger.debug('Stream stopped', { callSid: data.stop?.callSid });
        this.emit('call-ended', { callSid: this.callSid });
        break;

      case 'mark':
        this.emit('mark', { name: data.mark?.name });
        break;
    }
  }

  /**
   * Send PCM audio to Twilio (will be converted to μ-law)
   *
   * @param audio - Int16Array PCM audio data
   *
   * @example
   * ```typescript
   * aiVoice.on('audio', (pcmAudio) => {
   *   twilioVoice.sendAudio(pcmAudio);
   * });
   * ```
   */
  sendAudio(audio: Int16Array): void {
    if (!this.ws || !this.streamSid || !this.isConnected) {
      this.audioQueue.push(Buffer.from(audio.buffer));
      return;
    }

    // Convert PCM to μ-law for Twilio
    const mulawBuffer = pcmToMulaw(audio);

    this.ws.send(
      JSON.stringify({
        event: 'media',
        streamSid: this.streamSid,
        media: {
          payload: mulawBuffer.toString('base64'),
        },
      }),
    );
  }

  /**
   * Send a mark event to Twilio for synchronization
   *
   * @param name - Mark name identifier
   */
  sendMark(name: string): void {
    if (!this.ws || !this.streamSid || !this.isConnected) return;

    this.ws.send(
      JSON.stringify({
        event: 'mark',
        streamSid: this.streamSid,
        mark: { name },
      }),
    );
  }

  /**
   * Clear the audio playback queue on Twilio's side
   * Useful for barge-in scenarios
   */
  clearAudio(): void {
    if (!this.ws || !this.streamSid || !this.isConnected) return;

    this.ws.send(
      JSON.stringify({
        event: 'clear',
        streamSid: this.streamSid,
      }),
    );
  }

  /**
   * Get the current stream SID
   */
  getStreamSid(): string | undefined {
    return this.streamSid;
  }

  /**
   * Get the current call SID
   */
  getCallSid(): string | undefined {
    return this.callSid;
  }

  // ==========================================
  // MastraVoice abstract method implementations
  // ==========================================

  /**
   * Speak is handled by the AI provider via TelephonySession
   */
  async speak(): Promise<void> {
    // In telephony scenarios, TTS is handled by the AI provider
    // Audio flows: AI provider -> TelephonySession -> sendAudio()
  }

  /**
   * Listen is handled by the AI provider via TelephonySession
   */
  async listen(): Promise<string> {
    // In telephony scenarios, STT is handled by the AI provider
    // Audio flows: audio-received event -> TelephonySession -> AI provider
    return '';
  }

  /**
   * Register an event listener
   *
   * @param event - Event name
   * @param callback - Callback function
   *
   * Events:
   * - `call-started`: { callSid, streamSid }
   * - `audio-received`: { audio: Int16Array, streamSid }
   * - `call-ended`: { callSid }
   * - `mark`: { name }
   * - `error`: Error
   */
  on(event: string, callback: EventCallback): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(callback);
  }

  /**
   * Remove an event listener
   */
  off(event: string, callback: EventCallback): void {
    this.handlers.get(event)?.delete(callback);
  }

  /**
   * Emit an event
   */
  private emit(event: string, data?: unknown): void {
    this.handlers.get(event)?.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        this.logger.error(`Error in ${event} handler`, { error });
      }
    });
  }

  /**
   * Close the WebSocket connection
   */
  close(): void {
    this.isConnected = false;
    this.ws?.close();
  }
}
