import type { ToolsInput } from '../agent';
import { MastraVoice } from './voice';
import type { VoiceEventType, VoiceEventMap } from '.';

export class CompositeVoice extends MastraVoice<unknown, unknown, unknown, ToolsInput, VoiceEventMap> {
  /** @deprecated use output instead */
  protected speakProvider?: MastraVoice;
  /** @deprecated use input instead */
  protected listenProvider?: MastraVoice;
  /** @deprecated use realtime instead */
  protected realtimeProvider?: MastraVoice;

  protected output?: MastraVoice;
  protected input?: MastraVoice;
  protected realtime?: MastraVoice;

  constructor({
    speakProvider,
    listenProvider,
    realtimeProvider,
    output,
    input,
    realtime,
  }: {
    speakProvider?: MastraVoice;
    listenProvider?: MastraVoice;
    realtimeProvider?: MastraVoice;
    output?: MastraVoice;
    input?: MastraVoice;
    realtime?: MastraVoice;
  }) {
    super();
    this.speakProvider = speakProvider;
    this.listenProvider = listenProvider;
    this.realtimeProvider = realtimeProvider;
    this.output = output;
    this.input = input;
    this.realtime = realtime;
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
    if (this.realtime) {
      return this.realtime.speak(input, options);
    } else if (this.realtimeProvider) {
      return this.realtimeProvider.speak(input, options);
    } else if (this.output) {
      return this.output.speak(input, options);
    } else if (this.speakProvider) {
      return this.speakProvider.speak(input, options);
    }

    throw new Error('No speak provider or realtime provider configured');
  }

  async listen(audioStream: NodeJS.ReadableStream, options?: any) {
    if (this.realtime) {
      return this.realtime.listen(audioStream, options);
    } else if (this.realtimeProvider) {
      return await this.realtimeProvider.listen(audioStream, options);
    } else if (this.input) {
      return await this.input.listen(audioStream, options);
    } else if (this.listenProvider) {
      return await this.listenProvider.listen(audioStream, options);
    }

    throw new Error('No listen provider or realtime provider configured');
  }

  async getSpeakers() {
    if (this.realtime) {
      return this.realtime.getSpeakers();
    } else if (this.realtimeProvider) {
      return this.realtimeProvider.getSpeakers();
    } else if (this.output) {
      return this.output.getSpeakers();
    } else if (this.speakProvider) {
      return this.speakProvider.getSpeakers();
    }

    throw new Error('No speak provider or realtime provider configured');
  }

  updateConfig(options: Record<string, unknown>): void {
    if (this.realtime) {
      this.realtime.updateConfig(options);
    } else if (this.realtimeProvider) {
      this.realtimeProvider.updateConfig(options);
    }
  }

  /**
   * Initializes a WebSocket or WebRTC connection for real-time communication
   * @returns Promise that resolves when the connection is established
   */
  connect(options?: Record<string, unknown>): Promise<void> {
    if (this.realtime) {
      return this.realtime.connect(options);
    } else if (this.realtimeProvider) {
      return this.realtimeProvider.connect(options);
    }

    throw new Error('No realtime provider configured');
  }

  /**
   * Relay audio data to the voice provider for real-time processing
   * @param audioData Audio data to send
   */
  send(audioData: NodeJS.ReadableStream | Int16Array): Promise<void> {
    if (this.realtime) {
      return this.realtime.send(audioData);
    } else if (this.realtimeProvider) {
      return this.realtimeProvider.send(audioData);
    }

    throw new Error('No realtime provider configured');
  }

  /**
   * Trigger voice providers to respond
   */
  answer(options?: Record<string, unknown>): Promise<void> {
    if (this.realtime) {
      return this.realtime.answer(options);
    } else if (this.realtimeProvider) {
      return this.realtimeProvider.answer(options);
    }

    throw new Error('No realtime provider configured');
  }

  /**
   * Equip the voice provider with instructions
   * @param instructions Instructions to add
   */
  addInstructions(instructions: string): void {
    if (this.realtime) {
      return this.realtime.addInstructions(instructions);
    } else if (this.realtimeProvider) {
      return this.realtimeProvider.addInstructions(instructions);
    }
  }

  /**
   * Equip the voice provider with tools
   * @param tools Array of tools to add
   */
  addTools(tools: ToolsInput): void {
    if (this.realtime) {
      return this.realtime.addTools(tools);
    } else if (this.realtimeProvider) {
      return this.realtimeProvider.addTools(tools);
    }
  }

  /**
   * Disconnect from the WebSocket or WebRTC connection
   */
  close(): void {
    if (this.realtime) {
      return this.realtime.close();
    } else if (this.realtimeProvider) {
      return this.realtimeProvider.close();
    }

    throw new Error('No realtime provider configured');
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
    if (this.realtime) {
      return this.realtime.on(event, callback);
    } else if (this.realtimeProvider) {
      return this.realtimeProvider.on(event, callback);
    }

    throw new Error('No realtime provider configured');
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
    if (this.realtime) {
      return this.realtime.off(event, callback);
    } else if (this.realtimeProvider) {
      return this.realtimeProvider.off(event, callback);
    }

    throw new Error('No realtime provider configured');
  }
}
