import { MastraBase } from '../base';
import { InstrumentClass } from '../telemetry';

interface BuiltInModelConfig {
  name: string;
  apiKey?: string;
}

export interface VoiceConfig {
  listeningModel?: BuiltInModelConfig;
  speechModel?: BuiltInModelConfig;
  speaker?: string;
}

@InstrumentClass({
  prefix: 'voice',
  excludeMethods: ['__setTools', '__setLogger', '__setTelemetry', '#log'],
})
export abstract class MastraVoice extends MastraBase {
  protected listeningModel?: BuiltInModelConfig;
  protected speechModel?: BuiltInModelConfig;
  protected speaker?: string;

  constructor({ listeningModel, speechModel, speaker }: VoiceConfig) {
    super({
      component: 'VOICE',
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
  abstract speak(
    input: string | NodeJS.ReadableStream,
    options?: {
      speaker?: string;
      [key: string]: any;
    },
  ): Promise<NodeJS.ReadableStream>;

  /**
   * Convert speech to text
   * @param audioStream Audio stream to transcribe
   * @param options Provider-specific transcription options
   * @returns Text or text stream
   */
  abstract listen(
    audioStream: NodeJS.ReadableStream,
    options?: {
      [key: string]: any;
    },
  ): Promise<string | NodeJS.ReadableStream>;

  /**
   * Get available speakers/voices
   * @returns Array of available voice IDs and their metadata
   */
  abstract getSpeakers(): Promise<
    Array<{
      voiceId: string;
      [key: string]: any;
    }>
  >;
}
