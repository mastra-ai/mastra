import type { AdminStorage, ProjectSourceProvider, Runner, Router } from './providers';

export interface MastraAdminConfig {
  storage: AdminStorage;
  source: ProjectSourceProvider;
  runner: Runner;
  router: Router;
  fileStoragePath?: string;
}
