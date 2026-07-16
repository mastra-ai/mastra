import type { Analytics } from './analytics.js';
import type { EnvWriter } from './env.js';
import type { PackageManager } from './utils/pm.js';

/** Shared state threaded through the create-flow steps. */
export interface CreateContext {
  projectName: string;
  projectPath: string;
  env: EnvWriter;
  analytics: Analytics;
  packageManager: PackageManager;
  /** The local app origin OAuth callbacks are registered against. */
  publicUrl: string;
  /** Set by the database step; gates the integration steps. */
  databaseConfigured: boolean;
  /** True when the Docker compose DB defaults were chosen. */
  dockerDatabase: boolean;
  /** Set by the WorkOS step; gates the GitHub/Linear steps. */
  workosConfigured: boolean;
  githubConfigured: boolean;
  linearConfigured: boolean;
  /** Reminders shown in the outro for anything skipped or needing follow-up. */
  followUps: string[];
}

/** Default local-dev origin (Vite SPA). */
export const DEFAULT_PUBLIC_URL = 'http://localhost:5173';

/** APP_DATABASE_URL matching the template's docker-compose.yml defaults. */
export const DOCKER_DATABASE_URL = 'postgres://user:pass@localhost:54329/mastracode_web';
