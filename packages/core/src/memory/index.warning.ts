import { MastraMemory as BaseMemory } from './index';

export * from './index';

export abstract class MastraMemory extends BaseMemory {
  constructor() {
    // @ts-ignore
    super({ name: `Deprecated memory` });

    this.logger.warn('Please import "MastraMemory" from "@mastra/core/memory" instead of "@mastra/core"');
  }
}
