import { MastraBase } from '../base';
import { InstrumentClass } from '../telemetry';

interface BuiltInModelConfig {
  provider: string;
  name: string;
  apiKey?: string;
}

export interface TTSConfig {
  model: BuiltInModelConfig;
}

@InstrumentClass({
  prefix: 'tts',
  excludeMethods: ['__setTools', '__setLogger', '__setTelemetry', '#log'],
})
export abstract class MastraTTS extends MastraBase {
  model: BuiltInModelConfig;
  constructor({ model }: TTSConfig) {
    super({
      component: 'TTS',
    });
    this.model = model;
  }

  traced<T extends Function>(method: T, methodName: string): T {
    return (
      this.telemetry?.traceMethod(method, {
        spanName: `${this.model.name}-tts.${methodName}`,
        attributes: {
          'tts.type': `${this.model.name}`,
        },
      }) ?? method
    );
  }

  abstract generate({ text }: { text: string }): Promise<any>;
  abstract stream({ text }: { text: string }): Promise<any>;
}
