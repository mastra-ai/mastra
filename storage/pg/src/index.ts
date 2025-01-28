import { MastraStorage, WorkflowRunState } from '@mastra/core';
import pgPromise from 'pg-promise';
import type { IDatabase, IMain } from 'pg-promise';

export interface PostgresConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean;
}

export class PostgresStore extends MastraStorage {
  private db: IDatabase<any>;
  private pgp: IMain;

  constructor(config: PostgresConfig) {
    super('Postgres');
    this.pgp = pgPromise();
    this.db = this.pgp(config);
  }

  async init(tableName: string): Promise<void> {
    await this.db.none(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        workflow_name TEXT NOT NULL,
        run_id TEXT NOT NULL,
        snapshot JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (workflow_name, run_id)
      );
    `);
  }

  async clearTable(tableName: string): Promise<void> {
    await this.db.none(`TRUNCATE TABLE ${tableName}`);
  }

  async persistWorkflowSnapshot(params: {
    tableName: string;
    workflowName: string;
    runId: string;
    snapshot: WorkflowRunState;
  }): Promise<void> {
    const { tableName, workflowName, runId, snapshot } = params;

    await this.db.none(
      `
      INSERT INTO ${tableName}
        (workflow_name, run_id, snapshot, updated_at)
      VALUES
        ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (workflow_name, run_id)
      DO UPDATE SET
        snapshot = EXCLUDED.snapshot,
        updated_at = CURRENT_TIMESTAMP
    `,
      [workflowName, runId, snapshot],
    );
  }

  async loadWorkflowSnapshot(params: {
    tableName: string;
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    const { tableName, workflowName, runId } = params;

    const result = await this.db.oneOrNone(
      `
      SELECT snapshot
      FROM ${tableName}
      WHERE workflow_name = $1
        AND run_id = $2
    `,
      [workflowName, runId],
    );

    return result?.snapshot || null;
  }

  async close(): Promise<void> {
    await this.db.$pool.end();
  }
}
