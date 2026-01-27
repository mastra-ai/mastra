import type { AdminStorage, ProjectSourceProvider, Runner, Router } from './types/providers';
import type { MastraAdminConfig } from './types/config';

export class MastraAdmin {
  readonly storage: AdminStorage;
  readonly source: ProjectSourceProvider;
  readonly runner: Runner;
  readonly router: Router;
  readonly fileStoragePath: string;

  constructor(config: MastraAdminConfig) {
    this.storage = config.storage;
    this.source = config.source;
    this.runner = config.runner;
    this.router = config.router;
    this.fileStoragePath = config.fileStoragePath ?? './.mastra-admin/storage';
  }

  async init(): Promise<void> {
    await this.storage.init();
  }

  async close(): Promise<void> {
    await this.storage.close();
  }
}
