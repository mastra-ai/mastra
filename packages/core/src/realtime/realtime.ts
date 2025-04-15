import type { ToolsInput } from '../agent';
import { MastraBase } from '../base';
import { InstrumentClass } from '../telemetry';
import { PassThrough } from 'stream';

export type RealtimeEventType = 'transcribing' | 'writing' | 'speaking' | 'speaker' | 'error' | string;

export interface RealtimeEventMap {
  transcribing: { text: string };
  writing: { text: string; role: 'assistant' | 'user' };
  speaking: { audio: string };
  speaker: PassThrough & { id: string };
  error: { message: string };
}

export interface RealtimeConfig<T = unknown> {
  name?: string;
  model?: string;
  apiKey?: string;
  options?: T;
}

@InstrumentClass({
  prefix: 'realtime',
  excludeMethods: ['__setTools', '__setLogger', '__setTelemetry', '#log'],
})
export abstract class MastraRealtime<
  TOptions = unknown,
  TSpeakOptions = unknown,
  TSendOptions = unknown,
  TTools extends ToolsInput = ToolsInput,
  TEventArgs extends RealtimeEventMap = RealtimeEventMap,
  TSpeakerMetadata = unknown,
> extends MastraBase {
  constructor({ name }: RealtimeConfig<TOptions> = {}) {
    super({
      component: 'REALTIME',
      name,
    });
  }

  /**
   * Connect to the WebSocket or WebRTC connection
   */
  async connect(): Promise<void> {
    this.logger.warn('connect not implemented by this realtime provider');
  }

  /**
   * Equip the realtime provider with instructions
   * @param instructions Instructions to add
   */
  addInstructions(_instructions?: string): void {
    // Default implementation - realtime providers can override if they support this feature
    this.logger.warn('addInstructions not implemented by this realtime provider');
  }

  /**
   * Equip the realtime provider with tools
   * @param tools Array of tools to add
   */
  addTools(_tools: TTools): void {
    // Default implementation - realtime providers can override if they support this feature
    this.logger.warn('addTools not implemented by this realtime provider');
  }

  /**
   * Convert text to speech
   * @param input Text or text stream to convert to speech
   * @param options Speech options including speaker and provider-specific options
   * @returns Audio stream or void if in chat mode
   */
  speak(_input: string | NodeJS.ReadableStream, _options?: TSpeakOptions): Promise<NodeJS.ReadableStream | void> {
    this.logger.warn('speak not implemented by this realtime provider');
    return Promise.resolve();
  }

  /**
   * Relay audio data to the realtime provider for real-time processing
   * @param audioData Audio data to relay
   */
  send(_audioData: NodeJS.ReadableStream | Int16Array, _options?: TSendOptions): Promise<void> {
    // Default implementation - realtime providers can override if they support this feature
    this.logger.warn('relay not implemented by this realtime provider');
    return Promise.resolve();
  }

  /**
   * Disconnect from the WebSocket or WebRTC connection
   */
  close(): void {
    // Default implementation - realtime providers can override if they support this feature
    this.logger.warn('close not implemented by this realtime provider');
  }

  /**
   * Register an event listener
   * @param event Event name (e.g., 'transcribing', 'writing', 'speaking', 'error')
   * @param callback Callback function that receives event data
   */
  on<E extends RealtimeEventType>(
    _event: E,
    _callback: (data: E extends keyof TEventArgs ? TEventArgs[E] : unknown) => void,
  ): void {
    // Default implementation - realtime providers can override if they support this feature
    this.logger.warn('on not implemented by this realtime provider');
  }

  /**
   * Remove an event listener
   * @param event Event name (e.g., 'transcribing', 'writing', 'speaking', 'error')
   * @param callback Callback function to remove
   */
  off<E extends RealtimeEventType>(
    _event: E,
    _callback: (data: E extends keyof TEventArgs ? TEventArgs[E] : unknown) => void,
  ): void {
    // Default implementation - realtime providers can override if they support this feature
    this.logger.warn('off not implemented by this realtime provider');
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
    // Default implementation - realtime providers can override if they support this feature
    this.logger.warn('getSpeakers not implemented by this realtime provider');
    return Promise.resolve([]);
  }
}
