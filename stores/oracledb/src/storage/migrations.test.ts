import { describe, expect, it } from 'vitest';

import type { ObjectRow } from '../shared/connection';
import type { OracleQueryBinds, OracleTxClient } from './db';
import { OracleMigrationRegistry } from './migrations';
import type { OracleMigrationDatabase, OracleMigrationRecord } from './migrations';

class FakeMigrationDb implements OracleMigrationDatabase {
  readonly ddl: string[] = [];
  readonly writes: OracleQueryBinds[] = [];
  readonly records = new Map<string, OracleMigrationRecord>();

  table(tableName: string): string {
    return `"${tableName}"`;
  }

  async executeDdl(sql: string): Promise<void> {
    this.ddl.push(sql);
  }

  async manyOrNone<T extends ObjectRow = ObjectRow>(): Promise<T[]> {
    return [...this.records.values()] as T[];
  }

  async tx<T>(callback: (client: OracleTxClient) => Promise<T>): Promise<T> {
    const client = {
      none: async (_sql: string, binds: OracleQueryBinds = {}) => {
        this.writes.push(binds);
        const id = String(binds.id);
        this.records.set(id, {
          id,
          name: String(binds.name),
          kind: binds.kind as OracleMigrationRecord['kind'],
          checksum: String(binds.checksum),
          description: binds.description as string | null,
        });
      },
    } as OracleTxClient;

    return callback(client);
  }
}

describe('OracleMigrationRegistry', () => {
  it('skips unchanged repeatable migrations unless reconciliation is forced', async () => {
    const db = new FakeMigrationDb();
    const registry = new OracleMigrationRegistry({ db });
    let runs = 0;
    const migration = {
      id: 'R001_TEST_SCHEMA',
      name: 'Test schema',
      kind: 'repeatable' as const,
      run: async () => {
        runs += 1;
      },
    };

    const first = await registry.run([migration]);
    const second = await registry.run([migration]);
    const forced = await registry.run([migration], { forceRepeatable: true });

    expect(runs).toBe(2);
    expect(first[0]?.status).toBe('applied');
    expect(second[0]?.status).toBe('skipped');
    expect(forced[0]?.status).toBe('reapplied');
    expect(db.records.get('R001_TEST_SCHEMA')).toMatchObject({
      id: 'R001_TEST_SCHEMA',
      kind: 'repeatable',
      name: 'Test schema',
    });
  });

  it('skips an unchanged versioned migration after it is applied once', async () => {
    const db = new FakeMigrationDb();
    const registry = new OracleMigrationRegistry({ db });
    let runs = 0;
    const migration = {
      id: 'V001_CREATE_TABLE',
      name: 'Create table',
      run: async () => {
        runs += 1;
      },
    };

    const first = await registry.run([migration]);
    const second = await registry.run([migration]);

    expect(runs).toBe(1);
    expect(first[0]?.status).toBe('applied');
    expect(second[0]?.status).toBe('skipped');
  });

  it('reapplies repeatable migrations when their checksum changes', async () => {
    const db = new FakeMigrationDb();
    const registry = new OracleMigrationRegistry({ db });
    let runs = 0;

    await registry.run([
      {
        id: 'R001_TEST_SCHEMA',
        name: 'Test schema',
        kind: 'repeatable',
        description: 'v1',
        run: async () => {
          runs += 1;
        },
      },
    ]);
    const changed = await registry.run([
      {
        id: 'R001_TEST_SCHEMA',
        name: 'Test schema',
        kind: 'repeatable',
        description: 'v2',
        run: async () => {
          runs += 1;
        },
      },
    ]);

    expect(runs).toBe(2);
    expect(changed[0]?.status).toBe('reapplied');
  });

  it('rejects changed versioned migrations so applied history stays immutable', async () => {
    const db = new FakeMigrationDb();
    const registry = new OracleMigrationRegistry({ db });

    await registry.run([
      {
        id: 'V001_CREATE_TABLE',
        name: 'Create table',
        run: async () => undefined,
      },
    ]);

    await expect(
      registry.run([
        {
          id: 'V001_CREATE_TABLE',
          name: 'Create changed table',
          run: async () => undefined,
        },
      ]),
    ).rejects.toThrow(/already applied with checksum/i);
  });
});
