import { MastraBase } from '@internal/core/base';
import type { ToolsInput } from '@internal/core/types';

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

export interface VoiceSpanConfig {
  component: 'VOICE';
  name?: string;
  speaker?: string;
  listeningModel?: { name: string };
  speechModel?: { name: string };
  realtimeModel?: string;
}

export interface IMastraVoice<
  TSpeakOptions = unknown,
  TListenOptions = unknown,
  TTools extends ToolsInput = ToolsInput,
  TEventArgs extends VoiceEventMap = VoiceEventMap,
  TSpeakerMetadata = unknown,
> {
  serializeForSpan(): VoiceSpanConfig;
  speak(
    input: string | NodeJS.ReadableStream,
    options?: {
      speaker?: string;
    } & TSpeakOptions,
  ): Promise<NodeJS.ReadableStream | void>;
  listen(
    audioStream: NodeJS.ReadableStream | unknown,
    options?: TListenOptions,
  ): Promise<string | NodeJS.ReadableStream | void>;
  updateConfig(options: Record<string, unknown>): void;
  connect(options?: Record<string, unknown>): Promise<void>;
  send(audioData: NodeJS.ReadableStream | Int16Array): Promise<void>;
  answer(options?: Record<string, unknown>): Promise<void>;
  addInstructions(instructions?: string): void;
  addTools(tools: TTools): void;
  close(): void;
  on<E extends VoiceEventType>(
    event: E,
    callback: (data: E extends keyof TEventArgs ? TEventArgs[E] : unknown) => void,
  ): void;
  off<E extends VoiceEventType>(
    event: E,
    callback: (data: E extends keyof TEventArgs ? TEventArgs[E] : unknown) => void,
  ): void;
  getSpeakers(): Promise<
    Array<
      {
        voiceId: string;
      } & TSpeakerMetadata
    >
  >;
  getListener(): Promise<{ enabled: boolean }>;
}

export abstract class MastraVoice<
  TOptions = unknown,
  TSpeakOptions = unknown,
  TListenOptions = unknown,
  TTools extends ToolsInput = ToolsInput,
  TEventArgs extends VoiceEventMap = VoiceEventMap,
  TSpeakerMetadata = unknown,
>
  extends MastraBase
  implements IMastraVoice<TSpeakOptions, TListenOptions, TTools, TEventArgs, TSpeakerMetadata>
{
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

  /**
   * Custom serialization for tracing/observability spans.
   * Excludes `apiKey` from listeningModel / speechModel / realtimeConfig
   * and any provider-specific state held by subclasses. Subclasses that
   * need to expose additional non-sensitive fields can override.
   */
  serializeForSpan(): VoiceSpanConfig {
    return {
      component: 'VOICE',
      name: this.name,
      speaker: this.speaker,
      listeningModel: this.listeningModel ? { name: this.listeningModel.name } : undefined,
      speechModel: this.speechModel ? { name: this.speechModel.name } : undefined,
      realtimeModel: this.realtimeConfig?.model,
    };
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
    this.logger.debug('updateConfig not implemented by this voice provider');
  }

  /**
   * Initializes a WebSocket or WebRTC connection for real-time communication
   * @returns Promise that resolves when the connection is established
   */
  async connect(_options?: Record<string, unknown>): Promise<void> {
    // Default implementation - voice providers can override if they support this feature
    this.logger.debug('connect not implemented by this voice provider');
  }

  /**
   * Relay audio data to the voice provider for real-time processing
   * @param audioData Audio data to relay
   */
  async send(_audioData: NodeJS.ReadableStream | Int16Array): Promise<void> {
    // Default implementation - voice providers can override if they support this feature
    this.logger.debug('relay not implemented by this voice provider');
  }

  /**
   * Trigger voice providers to respond
   */
  async answer(_options?: Record<string, unknown>): Promise<void> {
    this.logger.debug('answer not implemented by this voice provider');
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
    this.logger.debug('close not implemented by this voice provider');
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
    this.logger.debug('on not implemented by this voice provider');
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
    this.logger.debug('off not implemented by this voice provider');
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
    this.logger.debug('getSpeakers not implemented by this voice provider');
    return Promise.resolve([]);
  }

  /**
   * Get available speakers/voices
   * @returns Array of available voice IDs and their metadata
   */
  getListener(): Promise<{ enabled: boolean }> {
    // Default implementation - voice providers can override if they support this feature
    this.logger.debug('getListener not implemented by this voice provider');
    return Promise.resolve({ enabled: false });
  }
}
