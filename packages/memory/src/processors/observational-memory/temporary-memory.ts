import { randomUUID } from 'node:crypto';

import type { AgentMemoryOption } from '@mastra/core/agent';
import type { MastraMemory } from '@mastra/core/memory';
import { InMemoryStore } from '@mastra/core/storage';
import { Memory } from '../../index';

export interface TemporaryOmMemoryContext {
  memory: MastraMemory;
  /**
   * Memory options pointing at a new, empty thread. Use one per model attempt so
   * a retry never reads back an earlier attempt's input or partial reply.
   */
  newThread(): AgentMemoryOption;
}

export function createTemporaryOmMemoryContext(prefix: string): TemporaryOmMemoryContext {
  const memoryOptions = {
    lastMessages: 10,
    generateTitle: false,
  };

  return {
    memory: new Memory({
      storage: new InMemoryStore(),
      options: memoryOptions,
    }),
    newThread: () => ({
      thread: `${prefix}-${randomUUID()}`,
      resource: prefix,
      options: memoryOptions,
    }),
  };
}
