import type { InValue } from '@libsql/client';
import type { IMastraLogger } from '@mastra/core/logger';
import type { TABLE_NAMES } from '@mastra/core/storage';
import { parseSqlIdentifier } from '@mastra/core/utils';

export function createExecuteWriteOperationWithRetry({
  logger,
  maxRetries,
  initialBackoffMs,
}: {
  logger: IMastraLogger;
  maxRetries: number;
  initialBackoffMs: number;
}) {
  return async function executeWriteOperationWithRetry<T>(
    operationFn: () => Promise<T>,
    operationDescription: string,
  ): Promise<T> {
    let retries = 0;

    while (true) {
      try {
        return await operationFn();
      } catch (error: any) {
        if (
          error.message &&
          (error.message.includes('SQLITE_BUSY') || error.message.includes('database is locked')) &&
          retries < maxRetries
        ) {
          retries++;
          const backoffTime = initialBackoffMs * Math.pow(2, retries - 1);
          logger.warn(
            `LibSQLStore: Encountered SQLITE_BUSY during ${operationDescription}. Retrying (${retries}/${maxRetries}) in ${backoffTime}ms...`,
          );
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        } else {
          logger.error(`LibSQLStore: Error during ${operationDescription} after ${retries} retries: ${error}`);
          throw error;
        }
      }
    }
  };
}

export function prepareStatement({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): {
  sql: string;
  args: InValue[];
} {
  const parsedTableName = parseSqlIdentifier(tableName, 'table name');
  const columns = Object.keys(record).map(col => parseSqlIdentifier(col, 'column name'));
  const values = Object.values(record).map(v => {
    if (typeof v === `undefined`) {
      // returning an undefined value will cause libsql to throw
      return null;
    }
    if (v instanceof Date) {
      return v.toISOString();
    }
    return typeof v === 'object' ? JSON.stringify(v) : v;
  });
  const placeholders = values.map(() => '?').join(', ');

  return {
    sql: `INSERT OR REPLACE INTO ${parsedTableName} (${columns.join(', ')}) VALUES (${placeholders})`,
    args: values,
  };
}
