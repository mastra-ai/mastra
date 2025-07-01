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

export interface VoiceModelConfig<T = unknown> {
  model?: string;
  apiKey?: string;
  options?: T;
}

export type SpeakOptions<
  T = Record<string, unknown>,
  TSpeaker extends string | undefined = string | undefined,
  TFiletype extends string | undefined = string | undefined,
> = {
  speaker?: TSpeaker;
  filetype?: TFiletype;
} & {
  [K in keyof T]: T[K];
};

export type ListenOptions<T = Record<string, unknown>> = {
  [K in keyof T]: T[K];
};

export interface VoiceConfig<T = unknown> {
  name?: string;
  speaker?: string;
  listeningModel?: VoiceModelConfig<T>;
  speechModel?: VoiceModelConfig<T>;
}

@InstrumentClass({
  prefix: 'voice',
  excludeMethods: ['__setTools', '__setLogger', '__setTelemetry', '#log'],
})
export abstract class MastraVoice<
  TSpeakOptions = SpeakOptions,
  TListenOptions = ListenOptions,
  TTools extends ToolsInput = ToolsInput,
  TEventArgs extends VoiceEventMap = VoiceEventMap,
  TSpeakerMetadata = unknown,
> extends MastraBase {
  protected listeningModel?: VoiceModelConfig;
  protected speechModel?: VoiceModelConfig;
  protected speaker?: string;

  constructor({ name, speaker, speechModel, listeningModel }: VoiceConfig) {
    super({
      component: 'VOICE',
      name,
    });
    this.listeningModel = listeningModel;
    this.speechModel = speechModel;
    this.speaker = speaker;
  }

  traced<T extends Function>(method: T, methodName: string): T {
    return (
      this.telemetry?.traceMethod(method, {
        spanName: `voice.${methodName}`,
        attributes: {
          'voice.type': this.speechModel?.model || this.listeningModel?.model || 'unknown',
        },
      }) ?? method
    );
  }

  /**
   * Converts text or a stream into speech audio.
   *
   * @param input Text string or readable stream to be synthesized into speech.
   * @param options Synthesis options, including speaker, file type, and provider-specific parameters.
   * @returns A readable audio stream, or void if operating in real-time mode.
   */
  abstract speak<T extends TSpeakOptions = TSpeakOptions>(
    input: string | NodeJS.ReadableStream,
    options?: T,
  ): Promise<NodeJS.ReadableStream | void>;

  /**
   * Convert speech to text
   * @template TOptions Provider-specific options type (default: TListenOptions)
   * @param audioStream Audio stream to transcribe
   * @param options Provider-specific transcription options
   * @returns Text, text stream, or void if in chat mode
   */
  abstract listen<T extends TListenOptions = TListenOptions>(
    audioStream: NodeJS.ReadableStream | unknown, // Allow other audio input types for OpenAI realtime API
    options?: T,
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

  /**
   * Get available speakers/voices
   * @returns Array of available voice IDs and their metadata
   */
  getListener(): Promise<{ enabled: boolean }> {
    // Default implementation - voice providers can override if they support this feature
    this.logger.warn('getListener not implemented by this voice provider');
    return Promise.resolve({ enabled: false });
  }
}
