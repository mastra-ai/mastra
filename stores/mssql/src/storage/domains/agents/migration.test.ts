import { AGENT_VERSIONS_SCHEMA, TABLE_AGENT_VERSIONS } from '@mastra/core/storage';
import type sql from 'mssql';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MssqlDB } from '../../db';
import { AgentsMSSQL } from '.';

describe('AgentsMSSQL migrations', () => {
  afterEach(() => vi.restoreAllMocks());

  it('adds modelList to existing agent version tables', async () => {
    vi.spyOn(MssqlDB.prototype, 'createTable').mockResolvedValue(undefined);
    const alterTable = vi.spyOn(MssqlDB.prototype, 'alterTable').mockResolvedValue(undefined);

    await new AgentsMSSQL({
      pool: { connected: true } as sql.ConnectionPool,
      skipDefaultIndexes: true,
    }).init();

    expect(alterTable).toHaveBeenCalledWith({
      tableName: TABLE_AGENT_VERSIONS,
      schema: AGENT_VERSIONS_SCHEMA,
      ifNotExists: ['modelList'],
    });
  });
});
