import type { ToolsInput } from '../agent';
import { MastraBase } from '../base';
import { InstrumentClass } from '../telemetry';

export type VoiceEventType = 'speaking' | 'writing' | 'error' | string;

export interface VoiceEventMap {
  speaker: NodeJS.ReadableStream;
  speaking: { audio?: string };
  writing: { text: string; role: 'assistant' | 'user' };
  error: { message: string; code?: string; details?: unknown };
  [key: string]: unknown;
}

interface BuiltInModelConfig {
  name: string;
  apiKey?: string;
}

export interface VoiceConfig<T = unknown> {
  listeningModel?: BuiltInModelConfig;
  speechModel?: BuiltInModelConfig;
  speaker?: string;
  name?: string;
  realtimeConfig?: {
    model?: string;
    apiKey?: string;
    options?: T;
  };
}

@InstrumentClass({
  prefix: 'voice',
  excludeMethods: ['__setTools', '__setLogger', '__setTelemetry', '#log'],
})
export abstract class MastraVoice<
  TOptions = unknown,
  TSpeakOptions = unknown,
  TListenOptions = unknown,
  TTools extends ToolsInput = ToolsInput,
  TEventArgs extends VoiceEventMap = VoiceEventMap,
  TSpeakerMetadata = unknown,
> extends MastraBase {
  protected listeningModel?: BuiltInModelConfig;
  protected speechModel?: BuiltInModelConfig;
  protected speaker?: string;
  protected realtimeConfig?: {
    model?: string;
    apiKey?: string;
    options?: TOptions;
  };

  constructor({ listeningModel, speechModel, speaker, realtimeConfig, name }: VoiceConfig<TOptions> = {}) {
    super({
      component: 'VOICE',
      name,
    });
    this.listeningModel = listeningModel;
    this.speechModel = speechModel;
    this.speaker = speaker;
    this.realtimeConfig = realtimeConfig;
  }

  traced<T extends Function>(method: T, methodName: string): T {
    return (
      this.telemetry?.traceMethod(method, {
        spanName: `voice.${methodName}`,
        attributes: {
          'voice.type': this.speechModel?.name || this.listeningModel?.name || 'unknown',
        },
      }) ?? method
    );
  }

  /**
   * Convert text to speech
   * @param input Text or text stream to convert to speech
   * @param options Speech options including speaker and provider-specific options
   * @returns Audio stream
   */
  /**
   * Convert text to speech
   * @param input Text or text stream to convert to speech
   * @param options Speech options including speaker and provider-specific options
   * @returns Audio stream or void if in chat mode
   */
  abstract speak(
    input: string | NodeJS.ReadableStream,
    options?: {
      speaker?: string;
    } & TSpeakOptions,
  ): Promise<NodeJS.ReadableStream | void>;

  /**
   * Convert speech to text
   * @param audioStream Audio stream to transcribe
   * @param options Provider-specific transcription options
   * @returns Text or text stream
   */
  /**
   * Convert speech to text
   * @param audioStream Audio stream to transcribe
   * @param options Provider-specific transcription options
   * @returns Text, text stream, or void if in chat mode
   */
  abstract listen(
    audioStream: NodeJS.ReadableStream | unknown, // Allow other audio input types for OpenAI realtime API
    options?: TListenOptions,
  ): Promise<string | NodeJS.ReadableStream | void>;

  updateConfig(_options: Record<string, unknown>): void {
    this.logger.warn('updateConfig not implemented by this voice provider');
  }

  /**
   * Initializes a WebSocket or WebRTC connection for real-time communication
   * @returns Promise that resolves when the connection is established
   */
  connect(_options?: Record<string, unknown>): Promise<void> {
    // Default implementation - voice providers can override if they support this feature
    this.logger.warn('connect not implemented by this voice provider');
    return Promise.resolve();
  }

  /**
   * Relay audio data to the voice provider for real-time processing
   * @param audioData Audio data to relay
   */
  send(_audioData: NodeJS.ReadableStream | Int16Array): Promise<void> {
    // Default implementation - voice providers can override if they support this feature
    this.logger.warn('relay not implemented by this voice provider');
    return Promise.resolve();
  }

  /**
   * Trigger voice providers to respond
   */
  answer(_options?: Record<string, unknown>): Promise<void> {
    this.logger.warn('answer not implemented by this voice provider');
    return Promise.resolve();
  }

  /**
   * Equip the voice provider with instructions
   * @param instructions Instructions to add
   */
  addInstructions(_instructions?: string): void {
    // Default implementation - voice providers can override if they support this feature
  }

  /**
   * Equip the voice provider with tools
   * @param tools Array of tools to add
   */
  addTools(_tools: TTools): void {
    // Default implementation - voice providers can override if they support this feature
  }

  /**
   * Disconnect from the WebSocket or WebRTC connection
   */
  close(): void {
    // Default implementation - voice providers can override if they support this feature
    this.logger.warn('close not implemented by this voice provider');
  }

  /**
   * Register an event listener
   * @param event Event name (e.g., 'speaking', 'writing', 'error')
   * @param callback Callback function that receives event data
   */
  on<E extends VoiceEventType>(
    _event: E,
    _callback: (data: E extends keyof TEventArgs ? TEventArgs[E] : unknown) => void,
  ): void {
    // Default implementation - voice providers can override if they support this feature
    this.logger.warn('on not implemented by this voice provider');
  }

  /**
   * Remove an event listener
   * @param event Event name (e.g., 'speaking', 'writing', 'error')
   * @param callback Callback function to remove
   */
  off<E extends VoiceEventType>(
    _event: E,
    _callback: (data: E extends keyof TEventArgs ? TEventArgs[E] : unknown) => void,
  ): void {
    // Default implementation - voice providers can override if they support this feature
    this.logger.warn('off not implemented by this voice provider');
  }

  /**
   * Get available speakers/voices
   * @returns Array of available voice IDs and their metadata
   */
  getSpeakers(): Promise<
    Array<
      {
        voiceId: string;
      } & TSpeakerMetadata
    >
  > {
    // Default implementation - voice providers can override if they support this feature
    this.logger.warn('getSpeakers not implemented by this voice provider');
    return Promise.resolve([]);
  }
}
