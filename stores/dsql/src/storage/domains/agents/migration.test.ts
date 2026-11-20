import { AGENT_VERSIONS_SCHEMA, TABLE_AGENT_VERSIONS } from '@mastra/core/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DsqlDB } from '../../db';
import type { DbClient } from '../../db';
import { AgentsDSQL } from '.';

describe('AgentsDSQL migrations', () => {
  afterEach(() => vi.restoreAllMocks());

  it('adds modelList to existing agent version tables', async () => {
    vi.spyOn(DsqlDB.prototype, 'createTable').mockResolvedValue(undefined);
    const alterTable = vi.spyOn(DsqlDB.prototype, 'alterTable').mockResolvedValue(undefined);

    await new AgentsDSQL({ client: {} as DbClient, skipDefaultIndexes: true }).init();

    expect(alterTable).toHaveBeenCalledWith({
      tableName: TABLE_AGENT_VERSIONS,
      schema: AGENT_VERSIONS_SCHEMA,
      ifNotExists: ['modelList'],
    });
  });
});
