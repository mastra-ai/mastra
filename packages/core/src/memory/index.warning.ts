import { MastraMemory as BaseMemory } from './index';

export * from './index';

export abstract class MastraMemory extends BaseMemory {
  constructor() {
    super();

    this.logger.warn('Please import from "@mastra/core/memory" instead of "@mastra/core"');
  }
}
