import { Pool } from 'pg';
import type { AdminStorage, TeamStorage, ProjectStorage, DeploymentStorage, BuildStorage } from '@mastra/admin';
import { TeamsPostgres } from './domains/teams';
import { ProjectsPostgres } from './domains/projects';
import { DeploymentsPostgres } from './domains/deployments';
import { BuildsPostgres } from './domains/builds';
import { runMigrations } from './migrations';

export interface PostgresAdminStorageConfig {
  connectionString?: string;
  pool?: Pool;
  schemaName?: string;
}

export class PostgresAdminStorage implements AdminStorage {
  readonly teams: TeamStorage;
  readonly projects: ProjectStorage;
  readonly deployments: DeploymentStorage;
  readonly builds: BuildStorage;

  #pool: Pool;
  #ownsPool: boolean;
  #schema: string;
  #initialized = false;

  constructor(config: PostgresAdminStorageConfig) {
    if (config.pool) {
      this.#pool = config.pool;
      this.#ownsPool = false;
    } else if (config.connectionString) {
      this.#pool = new Pool({ connectionString: config.connectionString, max: 20 });
      this.#ownsPool = true;
    } else {
      throw new Error('PostgresAdminStorage requires either pool or connectionString');
    }

    this.#schema = config.schemaName ?? 'mastra_admin';

    const domainConfig = { pool: this.#pool, schema: this.#schema };
    this.teams = new TeamsPostgres(domainConfig);
    this.projects = new ProjectsPostgres(domainConfig);
    this.deployments = new DeploymentsPostgres(domainConfig);
    this.builds = new BuildsPostgres(domainConfig);
  }

  async init(): Promise<void> {
    if (this.#initialized) return;

    // Create schema if not exists
    await this.#pool.query(`CREATE SCHEMA IF NOT EXISTS ${this.#schema}`);

    // Run migrations
    await runMigrations(this.#pool, this.#schema);

    this.#initialized = true;
  }

  async close(): Promise<void> {
    if (this.#ownsPool) {
      await this.#pool.end();
    }
  }

  get pool(): Pool {
    return this.#pool;
  }
}
