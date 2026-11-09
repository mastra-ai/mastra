import { ComputersStorage, COMPUTERS_SCHEMA, TABLE_COMPUTERS } from '@mastra/core/storage';
import type { StoredComputerRecord } from '@mastra/core/storage';

import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';
import type { SqliteClient as Client } from '../../db/client';

export class ComputersLibSQL extends ComputersStorage {
  readonly #db: LibSQLDB;
  readonly #client: Client;
  #initialized?: Promise<void>;

  constructor(config: LibSQLDomainConfig) {
    super();
    this.#client = resolveClient(config);
    this.#db = new LibSQLDB({ client: this.#client, maxRetries: config.maxRetries, initialBackoffMs: config.initialBackoffMs });
  }

  async init(): Promise<void> {
    this.#initialized ??= this.#db
      .createTable({ tableName: TABLE_COMPUTERS, schema: COMPUTERS_SCHEMA })
      .catch(error => {
        this.#initialized = undefined;
        throw error;
      });
    await this.#initialized;
  }

  async getComputer(id: string): Promise<StoredComputerRecord | undefined> {
    await this.init();
    const result = await this.#client.execute({ sql: `SELECT "value" FROM "${TABLE_COMPUTERS}" WHERE "id" = ? LIMIT 1`, args: [id] });
    const value = result.rows?.[0]?.value;
    if (value === undefined || value === null) return undefined;
    return (typeof value === 'string' ? JSON.parse(value) : value) as StoredComputerRecord;
  }

  async setComputer(record: StoredComputerRecord): Promise<void> {
    await this.init();
    const now = new Date().toISOString();
    await this.#client.execute({
      sql: `INSERT INTO "${TABLE_COMPUTERS}" ("id", "resourceId", "value", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?)
            ON CONFLICT ("id") DO UPDATE SET "resourceId" = excluded."resourceId", "value" = excluded."value", "updatedAt" = excluded."updatedAt"`,
      args: [record.id, record.ownerResourceId, JSON.stringify(record), now, now],
    });
  }

  async deleteComputer(id: string): Promise<void> {
    await this.init();
    await this.#client.execute({ sql: `DELETE FROM "${TABLE_COMPUTERS}" WHERE "id" = ?`, args: [id] });
  }

  async listComputers(resourceId: string): Promise<StoredComputerRecord[]> {
    await this.init();
    const result = await this.#client.execute({ sql: `SELECT "value" FROM "${TABLE_COMPUTERS}" WHERE "resourceId" = ? ORDER BY "createdAt" ASC`, args: [resourceId] });
    return (result.rows ?? []).map(row => (typeof row.value === 'string' ? JSON.parse(row.value) : row.value) as StoredComputerRecord);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.init();
    await this.#client.execute(`DELETE FROM "${TABLE_COMPUTERS}"`);
  }
}
