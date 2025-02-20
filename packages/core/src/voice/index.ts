import { PassThrough } from 'stream';

import { MastraBase } from '../base';
import { InstrumentClass } from '../telemetry';

interface BuiltInModelConfig {
  provider: string;
  name: string;
  apiKey?: string;
}

export interface SpeechConfig {
  model: BuiltInModelConfig;
}

@InstrumentClass({
  prefix: 'voice',
  excludeMethods: ['__setTools', '__setLogger', '__setTelemetry', '#log'],
})
export abstract class MastraVoice extends MastraBase {
  model: BuiltInModelConfig;

  constructor({ model }: SpeechConfig) {
    super({
      component: 'VOICE',
    });
    this.model = model;
  }

  traced<T extends Function>(method: T, methodName: string): T {
    return (
      this.telemetry?.traceMethod(method, {
        spanName: `${this.model.name}-voice.${methodName}`,
        attributes: {
          'voice.type': `${this.model.name}`,
        },
      }) ?? method
    );
  }

  // Text-to-Speech methods
  abstract speech({ text, voice }: { text: string; voice?: string }): Promise<{
    audioResult: Buffer;
  }>;

  abstract speechStream({ text, voice }: { text: string; voice?: string }): Promise<{
    audioResult: NodeJS.ReadableStream;
  }>;

  abstract voices(): Promise<Array<{ voice_id: string }>>;

  // Speech-to-Text methods
  transcribe?({ audio }: { audio: Buffer | Blob }): Promise<{
    text: string;
  }>;

  transcribeStream?({ audio }: { audio: NodeJS.ReadableStream }): Promise<NodeJS.ReadableStream>;
}
