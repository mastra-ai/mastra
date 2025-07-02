import type { ToolsInput } from '../agent';
import { MastraError, ErrorDomain, ErrorCategory } from '../error';
import { MastraVoice } from './voice';
import type { VoiceEventType, VoiceEventMap } from '.';

export class CompositeVoice extends MastraVoice<unknown, unknown, unknown, ToolsInput, VoiceEventMap> {
  protected speakProvider?: MastraVoice;
  protected listenProvider?: MastraVoice;
  protected realtimeProvider?: MastraVoice;

  constructor({
    input,
    output,
    realtime,
    speakProvider,
    listenProvider,
    realtimeProvider,
  }: {
    /** @deprecated use output instead */
    speakProvider?: MastraVoice;
    /** @deprecated use input instead */
    listenProvider?: MastraVoice;
    /** @deprecated use realtime instead */
    realtimeProvider?: MastraVoice;

    input?: MastraVoice;
    output?: MastraVoice;
    realtime?: MastraVoice;
  }) {
    super();
    this.speakProvider = output || speakProvider;
    this.listenProvider = input || listenProvider;
    this.realtimeProvider = realtime || realtimeProvider;
  }

  /**
   * Convert text to speech using the configured provider
   * @param input Text or text stream to convert to speech
   * @param options Speech options including speaker and provider-specific options
   * @returns Audio stream or void if in realtime mode
   */
  async speak(
    input: string | NodeJS.ReadableStream,
    options?: { speaker?: string } & any,
  ): Promise<NodeJS.ReadableStream | void> {
    if (this.realtimeProvider) {
      return this.realtimeProvider.speak(input, options);
    } else if (this.speakProvider) {
      return this.speakProvider.speak(input, options);
    }

    throw new MastraError({
      id: 'VOICE_COMPOSITE_NO_SPEAK_PROVIDER',
      text: 'No speak provider or realtime provider configured',
      domain: ErrorDomain.MASTRA_VOICE,
      category: ErrorCategory.USER,
    });
  }

  async listen(audioStream: NodeJS.ReadableStream, options?: any) {
    if (this.realtimeProvider) {
      return await this.realtimeProvider.listen(audioStream, options);
    } else if (this.listenProvider) {
      return await this.listenProvider.listen(audioStream, options);
    }

    throw new MastraError({
      id: 'VOICE_COMPOSITE_NO_LISTEN_PROVIDER',
      text: 'No listen provider or realtime provider configured',
      domain: ErrorDomain.MASTRA_VOICE,
      category: ErrorCategory.USER,
    });
  }

  async getSpeakers() {
    if (this.realtimeProvider) {
      return this.realtimeProvider.getSpeakers();
    } else if (this.speakProvider) {
      return this.speakProvider.getSpeakers();
    }

    throw new MastraError({
      id: 'VOICE_COMPOSITE_NO_SPEAKERS_PROVIDER',
      text: 'No speak provider or realtime provider configured',
      domain: ErrorDomain.MASTRA_VOICE,
      category: ErrorCategory.USER,
    });
  }

  async getListener() {
    if (this.realtimeProvider) {
      return this.realtimeProvider.getListener();
    } else if (this.listenProvider) {
      return this.listenProvider.getListener();
    }

    throw new MastraError({
      id: 'VOICE_COMPOSITE_NO_LISTENER_PROVIDER',
      text: 'No listener provider or realtime provider configured',
      domain: ErrorDomain.MASTRA_VOICE,
      category: ErrorCategory.USER,
    });
  }

  updateConfig(options: Record<string, unknown>): void {
    if (!this.realtimeProvider) {
      return;
    }
    this.realtimeProvider.updateConfig(options);
  }

  /**
   * Initializes a WebSocket or WebRTC connection for real-time communication
   * @returns Promise that resolves when the connection is established
   */
  connect(options?: Record<string, unknown>): Promise<void> {
    if (!this.realtimeProvider) {
      throw new MastraError({
        id: 'VOICE_COMPOSITE_NO_REALTIME_PROVIDER_CONNECT',
        text: 'No realtime provider configured',
        domain: ErrorDomain.MASTRA_VOICE,
        category: ErrorCategory.USER,
      });
    }
    return this.realtimeProvider.connect(options);
  }

  /**
   * Relay audio data to the voice provider for real-time processing
   * @param audioData Audio data to send
   */
  send(audioData: NodeJS.ReadableStream | Int16Array): Promise<void> {
    if (!this.realtimeProvider) {
      throw new MastraError({
        id: 'VOICE_COMPOSITE_NO_REALTIME_PROVIDER_SEND',
        text: 'No realtime provider configured',
        domain: ErrorDomain.MASTRA_VOICE,
        category: ErrorCategory.USER,
      });
    }
    return this.realtimeProvider.send(audioData);
  }

  /**
   * Trigger voice providers to respond
   */
  answer(options?: Record<string, unknown>): Promise<void> {
    if (!this.realtimeProvider) {
      throw new MastraError({
        id: 'VOICE_COMPOSITE_NO_REALTIME_PROVIDER_ANSWER',
        text: 'No realtime provider configured',
        domain: ErrorDomain.MASTRA_VOICE,
        category: ErrorCategory.USER,
      });
    }
    return this.realtimeProvider.answer(options);
  }

  /**
   * Equip the voice provider with instructions
   * @param instructions Instructions to add
   */
  addInstructions(instructions: string): void {
    if (!this.realtimeProvider) {
      return;
    }
    this.realtimeProvider.addInstructions(instructions);
  }

  /**
   * Equip the voice provider with tools
   * @param tools Array of tools to add
   */
  addTools(tools: ToolsInput): void {
    if (!this.realtimeProvider) {
      return;
    }
    this.realtimeProvider.addTools(tools);
  }

  /**
   * Disconnect from the WebSocket or WebRTC connection
   */
  close(): void {
    if (!this.realtimeProvider) {
      throw new MastraError({
        id: 'VOICE_COMPOSITE_NO_REALTIME_PROVIDER_CLOSE',
        text: 'No realtime provider configured',
        domain: ErrorDomain.MASTRA_VOICE,
        category: ErrorCategory.USER,
      });
    }
    this.realtimeProvider.close();
  }

  /**
   * Register an event listener
   * @param event Event name (e.g., 'speaking', 'writing', 'error')
   * @param callback Callback function that receives event data
   */
  on<E extends VoiceEventType>(
    event: E,
    callback: (data: E extends keyof VoiceEventMap ? VoiceEventMap[E] : unknown) => void,
  ): void {
    if (!this.realtimeProvider) {
      throw new MastraError({
        id: 'VOICE_COMPOSITE_NO_REALTIME_PROVIDER_ON',
        text: 'No realtime provider configured',
        domain: ErrorDomain.MASTRA_VOICE,
        category: ErrorCategory.USER,
      });
    }
    this.realtimeProvider.on(event, callback);
  }

  /**
   * Remove an event listener
   * @param event Event name (e.g., 'speaking', 'writing', 'error')
   * @param callback Callback function to remove
   */
  off<E extends VoiceEventType>(
    event: E,
    callback: (data: E extends keyof VoiceEventMap ? VoiceEventMap[E] : unknown) => void,
  ): void {
    if (!this.realtimeProvider) {
      throw new MastraError({
        id: 'VOICE_COMPOSITE_NO_REALTIME_PROVIDER_OFF',
        text: 'No realtime provider configured',
        domain: ErrorDomain.MASTRA_VOICE,
        category: ErrorCategory.USER,
      });
    }
    this.realtimeProvider.off(event, callback);
  }
}
