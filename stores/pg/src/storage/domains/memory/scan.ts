import { Buffer } from 'node:buffer';
import type { DbClient } from '../../client';

/** A bounded ID-ordered scan. The cursor is opaque and is not an authorization token. */
export type MemoryScanInput = {
  limit?: number;
  cursor?: string | null;
  resourceId?: string;
};

export type MemoryMessageScanInput = MemoryScanInput & { threadId?: string };

export type MemoryScanPage<T> = {
  records: T[];
  /** Null means this scan has reached its fixed upper ID. Start a new scan to revisit records. */
  nextCursor: string | null;
};

type Cursor = { version: 1; scope: string; after: string; until: string };

function decodeCursor(value: string, scope: string): Cursor {
  try {
    const cursor = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Cursor;
    if (
      cursor.version !== 1 ||
      cursor.scope !== scope ||
      typeof cursor.after !== 'string' ||
      !cursor.after ||
      typeof cursor.until !== 'string' ||
      !cursor.until
    )
      throw new Error('Invalid cursor');
    return cursor;
  } catch {
    throw new Error('Memory scan cursor is invalid or belongs to a different query.');
  }
}

/** Native storage helper: no offsets, total-count query, or persisted scan state. */
export async function scanById<T extends { id: string }>({
  client,
  table,
  select,
  scope,
  conditions = [],
  values = [],
  input,
}: {
  client: Pick<DbClient, 'manyOrNone'>;
  table: string;
  select: string;
  scope: string;
  conditions?: string[];
  values?: unknown[];
  input: MemoryScanInput;
}): Promise<MemoryScanPage<T>> {
  const limit = input.limit ?? 200;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
    throw new Error('Memory scan limit must be an integer between 1 and 500.');
  }
  if (input.cursor !== undefined && input.cursor !== null && typeof input.cursor !== 'string') {
    throw new Error('Memory scan cursor must be a string or null.');
  }
  const cursor = input.cursor == null ? null : decodeCursor(input.cursor, scope);
  const where = [...conditions];
  const params = [...values];
  let until = cursor?.until;
  if (!until) {
    const boundary = await client.manyOrNone<{ id: string }>(
      `SELECT id FROM ${table}${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY id DESC LIMIT 1`,
      params,
    );
    until = boundary[0]?.id;
    if (!until) return { records: [], nextCursor: null };
  }
  params.push(until);
  where.push(`id <= $${params.length}`);
  if (cursor) {
    params.push(cursor.after);
    where.push(`id > $${params.length}`);
  }
  params.push(limit + 1);
  const rows = await client.manyOrNone<T>(
    `SELECT ${select} FROM ${table} WHERE ${where.join(' AND ')} ORDER BY id ASC LIMIT $${params.length}`,
    params,
  );
  const records = rows.slice(0, limit);
  const nextCursor =
    rows.length > limit
      ? Buffer.from(
          JSON.stringify({ version: 1, scope, after: records[records.length - 1]!.id, until } satisfies Cursor),
        ).toString('base64url')
      : null;
  return { records, nextCursor };
}
