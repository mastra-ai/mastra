import { MastraVector as BaseMastraVector } from './index';

export * from './index';

export abstract class MastraVector extends BaseMastraVector {
  constructor() {
    super();

    this.logger.warn('Please import from "@mastra/core/vector" instead of "@mastra/core"');
  }
}
