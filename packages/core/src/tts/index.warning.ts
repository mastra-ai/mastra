import { MastraTTS as BaseMastraTTS, type TTSConfig } from './index';

export * from './index';

export abstract class MastraTTS extends BaseMastraTTS {
  constructor(args: TTSConfig) {
    super(args);

    this.logger.warn('Please import from "@mastra/core/tts" instead of "@mastra/core"');
  }
}
