import type { ApiRoute } from '@mastra/core/server';
import type { FactoryStorage } from '@mastra/core/storage';

/** Web-level domain with injected infrastructure and an HTTP route surface. */
export abstract class FactoryDomain {
  protected readonly storage: FactoryStorage;

  protected constructor({ storage }: { storage: FactoryStorage }) {
    this.storage = storage;
  }

  abstract routes(): ApiRoute[];
}
