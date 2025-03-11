import type { ToolsInput } from '../agent';
import { MastraVoice, type VoiceEventType, type VoiceEventMap } from '.';

export class CompositeVoice extends MastraVoice<unknown, unknown, unknown, ToolsInput, VoiceEventMap> {
  protected speakProvider?: MastraVoice;
  protected listenProvider?: MastraVoice;
  protected realtimeProvider?: MastraVoice;

  constructor({
    speakProvider,
    listenProvider,
    realtimeProvider,
  }: {
    speakProvider?: MastraVoice;
    listenProvider?: MastraVoice;
    realtimeProvider?: MastraVoice;
  }) {
    super();
    this.speakProvider = speakProvider;
    this.listenProvider = listenProvider;
    this.realtimeProvider = realtimeProvider;
  }

  async speak(input: string | NodeJS.ReadableStream, options?: any) {
    if (!this.speakProvider || !this.realtimeProvider) {
      throw new Error('No speak provider or realtime provider configured');
    }

    if (this.realtimeProvider) {
      await this.realtimeProvider.speak(input, options);
      return;
    }

    return this.speakProvider.speak(input, options);
  }

  async listen(audioStream: NodeJS.ReadableStream, options?: any) {
    if (!this.listenProvider || !this.realtimeProvider) {
      throw new Error('No listen provider or realtime provider configured');
    }

    if (this.realtimeProvider) {
      await this.realtimeProvider.listen(audioStream, options);
      return;
    }

    return this.listenProvider.listen(audioStream, options);
  }

  async getSpeakers() {
    if (!this.speakProvider) {
      throw new Error('No speak provider configured');
    }
    return this.speakProvider.getSpeakers();
  }

  updateConfig(options: Record<string, unknown>): void {
    if (!this.realtimeProvider) {
      throw new Error('No realtime provider configured');
    }
    this.realtimeProvider.updateConfig(options);
  }

  /**
   * Initializes a WebSocket or WebRTC connection for real-time communication
   * @returns Promise that resolves when the connection is established
   */
  connect(options?: Record<string, unknown>): Promise<void> {
    if (!this.realtimeProvider) {
      throw new Error('No realtime provider configured');
    }
    return this.realtimeProvider.connect(options);
  }

  /**
   * Relay audio data to the voice provider for real-time processing
   * @param audioData Audio data to send
   */
  send(audioData: NodeJS.ReadableStream | Int16Array): Promise<void> {
    if (!this.realtimeProvider) {
      throw new Error('No realtime provider configured');
    }
    return this.realtimeProvider.send(audioData);
  }

  /**
   * Trigger voice providers to respond
   */
  answer(options?: Record<string, unknown>): Promise<void> {
    if (!this.realtimeProvider) {
      throw new Error('No realtime provider configured');
    }
    return this.realtimeProvider.answer();
  }

  /**
   * Equip the voice provider with tools
   * @param tools Array of tools to add
   */
  addTools(tools: ToolsInput): void {
    if (!this.realtimeProvider) {
      throw new Error('No realtime provider configured');
    }
    this.realtimeProvider.addTools(tools);
  }

  /**
   * Disconnect from the WebSocket or WebRTC connection
   */
  close(): void {
    if (!this.realtimeProvider) {
      throw new Error('No realtime provider configured');
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
      throw new Error('No realtime provider configured');
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
      throw new Error('No realtime provider configured');
    }
    this.realtimeProvider.off(event, callback);
  }
}
