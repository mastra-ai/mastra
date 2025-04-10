import type { MemoryConfig, SharedMemoryConfig } from '@mastra/core/memory';
import { deepMerge } from '@mastra/core/utils';
import { defaultWorkingMemoryTemplate, Memory as MainMemory } from './index';

const newDefaults: MemoryConfig = {
  workingMemory: {
    enabled: false,
    template: defaultWorkingMemoryTemplate,
    use: 'tool-call',
  },
  semanticRecall: false,
  threads: {
    generateTitle: false,
  },
  lastMessages: 10,
};

export class Memory extends MainMemory {
  constructor(config: SharedMemoryConfig = {}) {
    super({
      ...config,
      options: deepMerge<MemoryConfig>(
        newDefaults,
        // merge any user config ontop
        config.options,
      ),
    });
  }
}
