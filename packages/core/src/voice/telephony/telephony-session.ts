/**
 * TelephonySession - Orchestrates telephony providers with voice-enabled agents
 *
 * Handles:
 * - Audio routing between telephony (phone) and agent's voice provider
 * - Turn-taking detection (when user finishes speaking)
 * - Barge-in (interrupting AI when user speaks)
 *
 * @example
 * ```typescript
 * import { Agent } from '@mastra/core/agent';
 * import { TelephonySession } from '@mastra/core/voice';
 * import { CompositeVoice } from '@mastra/core/voice';
 * import { OpenAIRealtimeVoice } from '@mastra/voice-openai-realtime';
 * import { TwilioVoice } from '@mastra/voice-twilio';
 *
 * const agent = new Agent({
 *   name: 'Phone Agent',
 *   model: openai('gpt-4o'),
 *   instructions: 'You are a helpful phone assistant.',
 *   voice: new CompositeVoice({
 *     realtime: new OpenAIRealtimeVoice(),
 *   }),
 * });
 *
 * const session = new TelephonySession({
 *   agent,
 *   telephony: new TwilioVoice(),
 * });
 *
 * session.on('ready', () => console.log('Call connected'));
 * await session.start();
 * ```
 */

import type { Agent, ToolsInput } from '../../agent';
import { MastraBase } from '../../base';
import { MastraError, ErrorDomain, ErrorCategory } from '../../error';
import { RegisteredLogger } from '../../logger';

import type { CompositeVoice } from '../composite-voice';
import type { MastraVoice } from '../voice';

import { mulawToPcm, pcmToMulaw, type AudioCodec } from './audio-codecs';

/**
 * Configuration for TelephonySession
 */
export interface TelephonySessionConfig {
  /**
   * The voice-enabled agent to use for the call.
   * The agent must have a voice configured with a realtime provider.
   */
  agent: Agent<string, ToolsInput>;

  /**
   * Telephony voice provider (e.g., TwilioVoice)
   * Handles phone call connection and audio transport
   */
  telephony: MastraVoice;

  /**
   * Audio codec used by telephony provider
   * @default 'mulaw'
   */
  codec?: AudioCodec;

  /**
   * Allow user to interrupt AI while it's speaking
   * @default true
   */
  bargeIn?: boolean;

  /**
   * Minimum audio energy to consider as speech (for barge-in detection)
   * @default 0.01
   */
  speechThreshold?: number;

  /**
   * Session name for logging
   */
  name?: string;
}

/**
 * Session state
 */
export type SessionState = 'idle' | 'connecting' | 'active' | 'ended';

/**
 * Who is currently speaking
 */
export type Speaker = 'none' | 'user' | 'agent';

/**
 * Session events
 */
export interface TelephonySessionEvents {
  /** Session is ready and connected */
  ready: { callSid?: string; streamSid?: string };
  /** Session ended */
  ended: { reason: string };
  /** User started speaking */
  'user:speaking': void;
  /** User stopped speaking, includes transcript if available */
  'user:stopped': { transcript?: string };
  /** Agent started speaking */
  'agent:speaking': void;
  /** Agent stopped speaking */
  'agent:stopped': void;
  /** Barge-in occurred - user interrupted agent */
  'barge-in': void;
  /** Error occurred */
  error: Error;
}

type EventCallback = (...args: unknown[]) => void;

/**
 * Orchestrates telephony providers with voice-enabled agents for phone calls.
 *
 * The session connects a telephony provider (like Twilio) with the agent's
 * voice provider, handling audio routing, format conversion, and turn-taking.
 */
export class TelephonySession extends MastraBase {
  private agent: Agent<string, ToolsInput>;
  private telephony: MastraVoice;
  private voice?: CompositeVoice;
  private codec: AudioCodec;
  private bargeInEnabled: boolean;
  private speechThreshold: number;

  private state: SessionState = 'idle';
  private speaker: Speaker = 'none';
  private streamSid?: string;
  private events: Map<string, Set<EventCallback>> = new Map();

  // For barge-in detection
  private agentSpeaking = false;

  constructor(config: TelephonySessionConfig) {
    super({
      component: RegisteredLogger.VOICE,
      name: config.name ?? config.agent.name,
    });

    this.agent = config.agent;
    this.telephony = config.telephony;
    this.codec = config.codec || 'mulaw';
    this.bargeInEnabled = config.bargeIn ?? true;
    this.speechThreshold = config.speechThreshold ?? 0.01;
  }

  /**
   * Start the telephony session
   *
   * This wires up the telephony provider and agent's voice:
   * - Phone audio → Agent's voice for processing
   * - Agent's voice audio → Phone for playback
   * - Handles barge-in detection
   */
  async start(): Promise<void> {
    if (this.state !== 'idle') {
      throw new MastraError({
        id: 'TELEPHONY_SESSION_INVALID_STATE',
        text: `Cannot start session in state: ${this.state}`,
        domain: ErrorDomain.MASTRA_VOICE,
        category: ErrorCategory.USER,
      });
    }

    this.state = 'connecting';
    this.logger.debug('Starting telephony session...');

    // Get the voice from the agent (already has tools and instructions configured)
    this.voice = (await this.agent.getVoice()) as CompositeVoice;

    if (!this.voice) {
      throw new MastraError({
        id: 'TELEPHONY_SESSION_NO_VOICE',
        text: 'Agent does not have a voice configured. Set agent.voice with a CompositeVoice that has a realtime provider.',
        domain: ErrorDomain.MASTRA_VOICE,
        category: ErrorCategory.USER,
      });
    }

    // Wire up telephony → voice (phone audio to AI)
    this.setupTelephonyToVoice();

    // Wire up voice → telephony (AI audio to phone)
    this.setupVoiceToTelephony();

    // Handle call lifecycle
    this.setupCallLifecycle();

    // Connect the voice provider
    try {
      await this.voice.connect();
      this.logger.debug('Voice provider connected');
    } catch (error) {
      this.emit('error', error as Error);
      this.state = 'idle';
      throw error;
    }
  }

  /**
   * End the session and clean up
   */
  end(reason = 'manual'): void {
    if (this.state === 'ended') return;

    this.logger.debug(`Ending session: ${reason}`);
    this.state = 'ended';

    // Close providers
    if (this.voice?.close) this.voice.close();
    if (this.telephony.close) this.telephony.close();

    this.emit('ended', { reason });
  }

  /**
   * Get current session state
   */
  getState(): SessionState {
    return this.state;
  }

  /**
   * Get who is currently speaking
   */
  getSpeaker(): Speaker {
    return this.speaker;
  }

  /**
   * Get the agent being used
   */
  getAgent(): Agent<string, ToolsInput> {
    return this.agent;
  }

  /**
   * Register an event listener
   */
  on<K extends keyof TelephonySessionEvents>(event: K, callback: (data: TelephonySessionEvents[K]) => void): void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(callback as EventCallback);
  }

  /**
   * Remove an event listener
   */
  off<K extends keyof TelephonySessionEvents>(event: K, callback: (data: TelephonySessionEvents[K]) => void): void {
    this.events.get(event)?.delete(callback as EventCallback);
  }

  // ==========================================
  // Private methods
  // ==========================================

  private emit<K extends keyof TelephonySessionEvents>(event: K, data?: TelephonySessionEvents[K]): void {
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          this.logger.error(`Error in ${event} handler`, { error });
        }
      });
    }
  }

  /**
   * Wire telephony audio to agent's voice provider
   */
  private setupTelephonyToVoice(): void {
    if (!this.voice) return;

    // Listen for audio from phone
    this.telephony.on('audio-received', (data: unknown) => {
      // Handle different data formats from providers
      let pcmAudio: Int16Array;

      if (data instanceof Int16Array) {
        pcmAudio = data;
      } else if (typeof data === 'object' && data !== null && 'audio' in data) {
        const audioData = (data as { audio: Int16Array | Buffer }).audio;
        if (audioData instanceof Int16Array) {
          pcmAudio = audioData;
        } else if (Buffer.isBuffer(audioData)) {
          pcmAudio = this.convertToPcm(audioData);
        } else {
          return;
        }
      } else if (Buffer.isBuffer(data)) {
        pcmAudio = this.convertToPcm(data);
      } else {
        return;
      }

      // Barge-in detection: if user speaks while agent is speaking
      if (this.bargeInEnabled && this.agentSpeaking) {
        const energy = this.calculateAudioEnergy(pcmAudio);
        if (energy > this.speechThreshold) {
          this.logger.debug('Barge-in detected');
          this.agentSpeaking = false;
          this.speaker = 'user';
          this.emit('barge-in');

          // Interrupt AI (if supported)
          if (this.voice?.answer) {
            void this.voice.answer({ interrupt: true });
          }
        }
      }

      // Track user speaking
      if (this.speaker !== 'user') {
        const energy = this.calculateAudioEnergy(pcmAudio);
        if (energy > this.speechThreshold) {
          this.speaker = 'user';
          this.emit('user:speaking');
        }
      }

      // Send audio to voice provider
      if (this.voice?.send) {
        void this.voice.send(pcmAudio);
      }
    });
  }

  /**
   * Wire agent's voice audio to telephony provider
   */
  private setupVoiceToTelephony(): void {
    if (!this.voice) return;

    // Listen for audio from voice
    this.voice.on('audio', (data: unknown) => {
      this.agentSpeaking = true;

      if (this.speaker !== 'agent') {
        this.speaker = 'agent';
        this.emit('agent:speaking');
      }

      // Convert and send to phone
      let pcmAudio: Int16Array;

      if (data instanceof Int16Array) {
        pcmAudio = data;
      } else if (typeof data === 'object' && data !== null && 'audio' in data) {
        const audioObj = data as { audio: Int16Array | Buffer | string };
        if (audioObj.audio instanceof Int16Array) {
          pcmAudio = audioObj.audio;
        } else if (Buffer.isBuffer(audioObj.audio)) {
          // Assume PCM buffer
          pcmAudio = new Int16Array(audioObj.audio.buffer, audioObj.audio.byteOffset, audioObj.audio.byteLength / 2);
        } else if (typeof audioObj.audio === 'string') {
          // Base64 encoded
          const buffer = Buffer.from(audioObj.audio, 'base64');
          pcmAudio = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 2);
        } else {
          return;
        }
      } else {
        return;
      }

      // Send to telephony provider
      this.sendToTelephony(pcmAudio);
    });

    // Track when agent stops speaking
    this.voice.on('speaking.done', () => {
      this.agentSpeaking = false;
      if (this.speaker === 'agent') {
        this.speaker = 'none';
        this.emit('agent:stopped');
      }
    });

    // Handle transcription events
    this.voice.on('writing', (data: unknown) => {
      if (typeof data === 'object' && data !== null && 'role' in data) {
        const writeData = data as { text: string; role: string };
        if (writeData.role === 'user' && writeData.text === '\n') {
          // User finished speaking
          this.speaker = 'none';
          this.emit('user:stopped', { transcript: writeData.text });
        }
      }
    });
  }

  /**
   * Handle call lifecycle events
   */
  private setupCallLifecycle(): void {
    // Call started
    this.telephony.on('call-started', (data: unknown) => {
      this.state = 'active';
      const metadata = data as { callSid?: string; streamSid?: string } | undefined;
      this.streamSid = metadata?.streamSid;
      this.logger.debug('Call started', { metadata });
      this.emit('ready', metadata || {});
    });

    // Call ended
    this.telephony.on('call-ended', () => {
      this.end('call-ended');
    });

    // Errors
    this.telephony.on('error', (error: unknown) => {
      this.emit('error', error as Error);
    });

    if (this.voice) {
      this.voice.on('error', (error: unknown) => {
        this.emit('error', error as Error);
      });
    }
  }

  /**
   * Convert telephony audio to PCM
   */
  private convertToPcm(buffer: Buffer): Int16Array {
    if (this.codec === 'mulaw') {
      return mulawToPcm(buffer);
    }
    // Assume PCM if unknown
    return new Int16Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 2);
  }

  /**
   * Send PCM audio to telephony provider
   */
  private sendToTelephony(pcm: Int16Array): void {
    // Convert PCM to telephony format
    const encoded = this.codec === 'mulaw' ? pcmToMulaw(pcm) : Buffer.from(pcm.buffer);

    // Send via telephony provider
    // Different providers have different methods
    const tel = this.telephony as unknown as {
      sendAudio?: (audio: Int16Array) => void;
      send?: (audio: Int16Array | Buffer) => void;
    };

    if (tel.sendAudio) {
      tel.sendAudio(pcm);
    } else if (tel.send) {
      void tel.send(encoded as unknown as Int16Array);
    }
  }

  /**
   * Calculate audio energy for voice activity detection
   */
  private calculateAudioEnergy(audio: Int16Array): number {
    let sum = 0;
    for (let i = 0; i < audio.length; i++) {
      sum += Math.abs(audio[i]!);
    }
    return sum / audio.length / 32768; // Normalize to 0-1
  }
}
