/**
 * TelephonySession - Orchestrates telephony and AI voice providers
 *
 * Handles:
 * - Audio routing between telephony (phone) and AI providers
 * - Turn-taking detection (when user finishes speaking)
 * - Barge-in (interrupting AI when user speaks)
 * - Call ↔ agent mapping
 *
 * @example
 * ```typescript
 * const session = new TelephonySession({
 *   telephony: twilioVoice,
 *   ai: openaiRealtimeVoice,
 *   agent: myAgent,
 *   bargeIn: true,
 * });
 *
 * session.on('ready', () => console.log('Call connected'));
 * session.start();
 * ```
 */

import type { Agent, ToolsInput } from '../../agent';

import type { MastraVoice } from '../voice';

import { mulawToPcm, pcmToMulaw, type AudioCodec } from './audio-codecs';

/**
 * Configuration for TelephonySession
 */
export interface TelephonySessionConfig {
  /**
   * Telephony voice provider (e.g., TwilioVoice)
   * Handles phone call connection and audio transport
   */
  telephony: MastraVoice;

  /**
   * AI voice provider (e.g., OpenAIRealtimeVoice)
   * Handles speech-to-speech AI processing
   */
  ai: MastraVoice;

  /**
   * Optional Mastra agent for context
   * Tools and instructions will be added to the AI voice
   */
  agent?: Agent<string, ToolsInput>;

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
   * Enable debug logging
   * @default false
   */
  debug?: boolean;
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
 * Orchestrates telephony and AI voice providers for phone calls
 */
export class TelephonySession {
  private telephony: MastraVoice;
  private ai: MastraVoice;
  private agent?: Agent<string, ToolsInput>;
  private codec: AudioCodec;
  private bargeIn: boolean;
  private speechThreshold: number;
  private debug: boolean;

  private state: SessionState = 'idle';
  private speaker: Speaker = 'none';
  private streamSid?: string;
  private events: Map<string, Set<EventCallback>> = new Map();

  // For barge-in detection
  private agentSpeaking = false;

  constructor(config: TelephonySessionConfig) {
    this.telephony = config.telephony;
    this.ai = config.ai;
    this.agent = config.agent;
    this.codec = config.codec || 'mulaw';
    this.bargeIn = config.bargeIn ?? true;
    this.speechThreshold = config.speechThreshold ?? 0.01;
    this.debug = config.debug ?? false;
  }

  /**
   * Start the telephony session
   *
   * This wires up the telephony and AI providers:
   * - Phone audio → AI for processing
   * - AI audio → Phone for playback
   * - Handles barge-in detection
   */
  async start(): Promise<void> {
    if (this.state !== 'idle') {
      throw new Error(`Cannot start session in state: ${this.state}`);
    }

    this.state = 'connecting';
    this.log('Starting telephony session...');

    // Add agent tools and instructions to AI voice
    if (this.agent) {
      await this.setupAgentContext();
    }

    // Wire up telephony → AI (phone audio to AI)
    this.setupTelephonyToAI();

    // Wire up AI → telephony (AI audio to phone)
    this.setupAIToTelephony();

    // Handle call lifecycle
    this.setupCallLifecycle();

    // Connect AI provider
    try {
      if (this.ai.connect) {
        await this.ai.connect();
      }
      this.log('AI provider connected');
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

    this.log(`Ending session: ${reason}`);
    this.state = 'ended';

    // Close providers
    if (this.ai.close) this.ai.close();
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
          console.error(`Error in ${event} handler:`, error);
        }
      });
    }
  }

  private log(...args: unknown[]): void {
    if (this.debug) {
      console.log('[TelephonySession]', ...args);
    }
  }

  /**
   * Add agent tools and instructions to the AI voice provider
   */
  private async setupAgentContext(): Promise<void> {
    if (!this.agent) return;

    // Add tools
    if (this.ai.addTools) {
      const tools = await this.agent.listTools();
      if (tools && Object.keys(tools).length > 0) {
        this.ai.addTools(tools);
        this.log(`Added ${Object.keys(tools).length} tools from agent`);
      }
    }

    // Add instructions
    if (this.ai.addInstructions) {
      const instructions = await this.agent.getInstructions();
      if (typeof instructions === 'string') {
        this.ai.addInstructions(instructions);
        this.log('Added agent instructions');
      }
    }
  }

  /**
   * Wire telephony audio to AI provider
   */
  private setupTelephonyToAI(): void {
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
      if (this.bargeIn && this.agentSpeaking) {
        const energy = this.calculateAudioEnergy(pcmAudio);
        if (energy > this.speechThreshold) {
          this.log('Barge-in detected');
          this.agentSpeaking = false;
          this.speaker = 'user';
          this.emit('barge-in');

          // Interrupt AI (if supported)
          if (this.ai.answer) {
            void this.ai.answer({ interrupt: true });
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

      // Send audio to AI provider
      if (this.ai.send) {
        void this.ai.send(pcmAudio);
      }
    });
  }

  /**
   * Wire AI audio to telephony provider
   */
  private setupAIToTelephony(): void {
    // Listen for audio from AI
    this.ai.on('audio', (data: unknown) => {
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

    // Track when AI stops speaking
    this.ai.on('speaking.done', () => {
      this.agentSpeaking = false;
      if (this.speaker === 'agent') {
        this.speaker = 'none';
        this.emit('agent:stopped');
      }
    });

    // Handle transcription events
    this.ai.on('writing', (data: unknown) => {
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
      this.log('Call started:', metadata);
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

    this.ai.on('error', (error: unknown) => {
      this.emit('error', error as Error);
    });
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
      sendAudio?: (streamSid: string, audio: Int16Array) => void;
      send?: (audio: Int16Array | Buffer) => void;
    };

    if (tel.sendAudio && this.streamSid) {
      // TwilioVoice style
      tel.sendAudio(this.streamSid, pcm);
    } else if (tel.send) {
      // Generic style
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
