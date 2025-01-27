import { createClient } from '@libsql/client';
import type { Client } from '@libsql/client';
import { MastraStorage, WorkflowRunState } from '@mastra/core';

export interface LibSQLConfig {
  url: string;
  authToken?: string;
}

export class LibSQLStorage extends MastraStorage {
  private client: Client;

  constructor(config: LibSQLConfig) {
    super();
    this.client = createClient({
      url: config.url,
      authToken: config.authToken,
    });
  }

  async init(tableName: string): Promise<void> {
    await this.client.execute(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        workflow_name TEXT NOT NULL,
        run_id TEXT NOT NULL,
        snapshot TEXT NOT NULL,
        created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        PRIMARY KEY (workflow_name, run_id)
      );
    `);
  }

  async clearTable(tableName: string): Promise<void> {
    await this.client.execute(`DELETE FROM ${tableName}`);
  }

  async persistWorkflowSnapshot(params: {
    tableName: string;
    workflowName: string;
    runId: string;
    snapshot: WorkflowRunState;
  }): Promise<void> {
    const { tableName, workflowName, runId, snapshot } = params;

    const data = {
      ...snapshot,
      _metadata: {
        updatedAt: new Date().toISOString(),
      },
    };

    await this.client.execute({
      sql: `
        INSERT INTO ${tableName} (workflow_name, run_id, snapshot, updated_at)
        VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        ON CONFLICT (workflow_name, run_id) DO UPDATE SET
          snapshot = excluded.snapshot,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      `,
      args: [workflowName, runId, JSON.stringify(data)],
    });
  }

  async loadWorkflowSnapshot(params: {
    tableName: string;
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    const { tableName, workflowName, runId } = params;

    const result = await this.client.execute({
      sql: `
        SELECT snapshot
        FROM ${tableName}
        WHERE workflow_name = ? AND run_id = ?
      `,
      args: [workflowName, runId],
    });

    if (result.rows.length === 0) {
      return null;
    }

    const data = JSON.parse(result.rows[0].snapshot as string);
    // Remove metadata before returning
    const { _metadata, ...snapshot } = data;
    return snapshot;
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
