import { MastraStorage } from '@mastra/core/storage';
import type { StorageDomains } from '@mastra/core/storage';
import type { GlideClientConfiguration } from '@valkey/valkey-glide';

import { GlideValkeyClient } from '../client';
import { StoreMemoryValkey } from './domains/memory';
import { ScoresValkey } from './domains/scores';
import { WorkflowsValkey } from './domains/workflows';
import type { ValkeyClient, ValkeyConfig } from './types';

/** GLIDE-backed Valkey storage adapter for Mastra. */
export class ValkeyStore extends MastraStorage {
  private readonly client: ValkeyClient;
  private readonly shouldManageConnection: boolean;
  public stores: StorageDomains;

  constructor(config: ValkeyConfig) {
    super({ id: config.id, name: 'Valkey', disableInit: config.disableInit });

    if ('client' in config) {
      this.client = new GlideValkeyClient(undefined, config.client);
      this.shouldManageConnection = false;
    } else {
      const glideConfig: GlideClientConfiguration =
        'config' in config
          ? config.config
          : {
              addresses: [{ host: config.host, port: config.port ?? 6379 }],
              databaseId: config.db ?? 0,
              credentials: config.password
                ? { username: config.username ?? 'default', password: config.password }
                : undefined,
              useTLS: config.useTLS,
            };
      this.client = new GlideValkeyClient(glideConfig);
      this.shouldManageConnection = true;
    }

    this.stores = {
      scores: new ScoresValkey({ client: this.client }),
      workflows: new WorkflowsValkey({ client: this.client }),
      memory: new StoreMemoryValkey({ client: this.client }),
    };
  }

  public override async init(): Promise<void> {
    if (this.shouldManageConnection) await this.client.connect();
    await super.init();
  }

  public getClient(): ValkeyClient {
    return this.client;
  }

  public async close(): Promise<void> {
    if (this.shouldManageConnection) await this.client.quit();
  }
}
