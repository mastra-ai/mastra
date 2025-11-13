import { MastraStorage } from '@mastra/core/storage';
import type { StorageDomains } from '@mastra/core/storage';

import { Redis } from '@upstash/redis';
import { EvalsStorageUpstash } from './domains/evals';
import { MemoryStorageUpstash } from './domains/memory';
import { WorkflowsStorageUpstash } from './domains/workflows';

export interface UpstashConfig {
  id: string;
  url: string;
  token: string;
}

export { EvalsStorageUpstash } from './domains/evals';
export { MemoryStorageUpstash } from './domains/memory';
export { WorkflowsStorageUpstash } from './domains/workflows';
export class UpstashStore extends MastraStorage {
  private redis: Redis;
  stores: StorageDomains;

  constructor(config: UpstashConfig) {
    super({ id: config.id, name: 'Upstash' });
    this.redis = new Redis({
      url: config.url,
      token: config.token,
    });

    const evals = new EvalsStorageUpstash({ client: this.redis });
    const workflows = new WorkflowsStorageUpstash({ client: this.redis });
    const memory = new MemoryStorageUpstash({ client: this.redis });
    this.stores = {
      evals,
      workflows,
      memory,
    };
  }

  public get supports() {
    return {
      selectByIncludeResourceScope: true,
      resourceWorkingMemory: true,
      hasColumn: false,
      createTable: false,
      deleteMessages: true,
      listScoresBySpan: true,
    };
  }
}
