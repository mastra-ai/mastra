import { createMemoryTokenBoundaryConformanceTest } from '@internal/storage-test-utils';

import { MemoryStorageDO } from './index';

function createSqlStorage() {
  const threads = new Map<string, Record<string, unknown>>();
  const sql = {
    exec(query: string, ...params: unknown[]) {
      const normalized = query.trim().replaceAll(/\s+/g, ' ');
      let rows: Record<string, unknown>[] = [];
      let rowsWritten = 0;

      if (/^INSERT/i.test(normalized) && normalized.includes('mastra_threads')) {
        const columns = normalized
          .match(/\(([^)]+)\)\s*VALUES/i)?.[1]
          ?.split(',')
          .map(column => column.trim().replaceAll(/["`]/g, ''));
        if (!columns) throw new Error(`Unexpected INSERT: ${normalized}`);
        const row = Object.fromEntries(columns.map((column, index) => [column, params[index]]));
        threads.set(String(row.id), row);
        rowsWritten = 1;
      } else if (/^SELECT/i.test(normalized) && normalized.includes('mastra_threads')) {
        const row = threads.get(String(params[0]));
        if (row && (!normalized.includes('resourceId = ?') || row.resourceId === params[1])) rows = [{ ...row }];
      } else if (/^UPDATE/i.test(normalized) && normalized.includes('mastra_threads')) {
        const hasResourceFilter = normalized.includes('resourceId = ?');
        const idIndex = 2;
        const resourceIndex = hasResourceFilter ? 3 : -1;
        const metadataIndex = hasResourceFilter ? 4 : 3;
        const row = threads.get(String(params[idIndex]));
        const metadataMatches = normalized.includes('metadata IS NULL')
          ? row?.metadata == null
          : row?.metadata === params[metadataIndex];
        if (row && (!hasResourceFilter || row.resourceId === params[resourceIndex]) && metadataMatches) {
          row.metadata = params[0];
          row.updatedAt = params[1];
          rowsWritten = 1;
        }
      }

      return { toArray: () => rows, rowsWritten };
    },
  };
  return sql;
}

createMemoryTokenBoundaryConformanceTest({
  repetitions: 20,
  createStores: () => {
    const sql = createSqlStorage();
    return {
      first: new MemoryStorageDO({ sql: sql as never }),
      second: new MemoryStorageDO({ sql: sql as never }),
    };
  },
});
