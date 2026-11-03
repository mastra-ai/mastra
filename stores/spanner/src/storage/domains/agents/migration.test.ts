import type { Database } from '@google-cloud/spanner';
import { AGENT_VERSIONS_SCHEMA, TABLE_AGENT_VERSIONS } from '@mastra/core/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SpannerDB } from '../../db';
import { AgentsSpanner } from '.';

describe('AgentsSpanner migrations', () => {
  afterEach(() => vi.restoreAllMocks());

  it('adds modelList to existing agent version tables', async () => {
    vi.spyOn(SpannerDB.prototype, 'createTable').mockResolvedValue(undefined);
    const alterTable = vi.spyOn(SpannerDB.prototype, 'alterTable').mockResolvedValue(undefined);

    await new AgentsSpanner({
      database: {} as Database,
      skipDefaultIndexes: true,
    }).init();

    expect(alterTable).toHaveBeenCalledWith({
      tableName: TABLE_AGENT_VERSIONS,
      schema: AGENT_VERSIONS_SCHEMA,
      ifNotExists: ['modelList'],
    });
  });
});
