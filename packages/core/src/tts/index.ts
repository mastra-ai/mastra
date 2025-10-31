import { MastraBase } from '../base';

interface BuiltInModelConfig {
  provider: string;
  name: string;
  apiKey?: string;
}

export interface TTSConfig {
  model: BuiltInModelConfig;
}

export abstract class MastraTTS extends MastraBase {
  model: BuiltInModelConfig;
  constructor({ model }: TTSConfig) {
    super({
      component: 'TTS',
    });
    this.model = model;
  }

  abstract generate({ text }: { text: string }): Promise<any>;
  abstract stream({ text }: { text: string }): Promise<any>;
}
