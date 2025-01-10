import { MastraBase } from '../base';
import { InstrumentClass } from '../telemetry';

interface BuiltInModelConfig {
  provider: string;
  name: string;
  apiKey?: string;
}

@InstrumentClass({
  prefix: 'tts',
  excludeMethods: ['__setTools', '__setLogger', '__setTelemetry', '#log'],
})
export abstract class MastraTTS extends MastraBase {
  model: BuiltInModelConfig;
  constructor({ model }: { model: BuiltInModelConfig }) {
    super({
      component: 'TTS',
    });
    this.model = model;
  }

  abstract generate({ text }: { text: string }): Promise<any>;
  abstract stream({ text }: { text: string }): Promise<any>;
}
