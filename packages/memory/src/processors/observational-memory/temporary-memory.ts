import { randomUUID } from 'node:crypto';

import type { AgentMemoryOption } from '@mastra/core/agent';
import type { MastraMemory } from '@mastra/core/memory';
import { InMemoryStore } from '@mastra/core/storage';

export interface TemporaryOmMemoryContext {
  memory: MastraMemory;
  options: AgentMemoryOption;
}

export async function createTemporaryOmMemoryContext(prefix: string): Promise<TemporaryOmMemoryContext> {
  const { Memory } = await import('../../index');
  const threadId = `${prefix}-${randomUUID()}`;
  const resourceId = prefix;
  const options: AgentMemoryOption = {
    thread: threadId,
    resource: resourceId,
    options: {
      lastMessages: 10,
      generateTitle: false,
    },
  };

  return {
    memory: new Memory({
      storage: new InMemoryStore(),
      options: options.options,
    }),
    options,
  };
}
