import { parseSqlIdentifier } from '@mastra/core/utils';

import type { DbClient } from '../../../client';
import type { FilterAccumulator } from './filters';
import { newFilterAccumulator, whereOrEmpty } from './filters';
import { encodeDeltaCursor, validateCursorId } from './polling';

type SortDirection = 'ASC' | 'DESC';

type SignalItems<Key extends string, Item> = Record<Key, Item[]>;

interface SignalListConfig<Filters, Row extends { cursorId?: unknown }, Item, Key extends string> {
  client: DbClient;
  table: string;
  filters: Filters;
  selectColumns: string;
  responseKey: Key;
  applyFilters: (acc: FilterAccumulator, filters: Filters) => void;
  mapRow: (row: Row) => Item;
}

function responseItems<Key extends string, Item>(key: Key, items: Item[]): SignalItems<Key, Item> {
  return { [key]: items } as SignalItems<Key, Item>;
}

export async function readSignalStreamHeadCursor<Filters>({
  client,
  table,
  filters,
  applyFilters,
}: Pick<
  SignalListConfig<Filters, { cursorId?: unknown }, unknown, string>,
  'client' | 'table' | 'filters' | 'applyFilters'
>): Promise<string> {
  const acc = newFilterAccumulator();
  applyFilters(acc, filters);
  const filtered = await client.oneOrNone<{ cursorId: string | null }>(
    `SELECT MAX("cursorId")::text AS "cursorId" FROM ${table} ${whereOrEmpty(acc)}`,
    acc.params,
  );
  if (filtered?.cursorId != null) return encodeDeltaCursor(filtered.cursorId);

  const head = await client.oneOrNone<{ cursorId: string | null }>(
    `SELECT MAX("cursorId")::text AS "cursorId" FROM ${table}`,
  );
  return encodeDeltaCursor(head?.cursorId);
}

export async function listSignalPage<Filters, Row extends { cursorId?: unknown }, Item, Key extends string>(
  config: SignalListConfig<Filters, Row, Item, Key> & {
    page: number;
    perPage: number;
    orderField: string;
    orderDir: SortDirection;
    includeDeltaCursor: boolean;
  },
): Promise<
  {
    pagination: { total: number; page: number; perPage: number; hasMore: boolean };
    deltaCursor?: string;
  } & SignalItems<Key, Item>
> {
  const {
    client,
    table,
    filters,
    selectColumns,
    responseKey,
    applyFilters,
    mapRow,
    page,
    perPage,
    orderField,
    orderDir,
  } = config;

  const acc = newFilterAccumulator();
  applyFilters(acc, filters);
  const whereClause = whereOrEmpty(acc);

  const countRow = await client.oneOrNone<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM ${table} ${whereClause}`,
    acc.params,
  );
  const total = Number(countRow?.count ?? 0);

  let items: Item[] = [];
  if (total > 0) {
    const safeOrderField = parseSqlIdentifier(orderField, 'order field');
    const rows = await client.manyOrNone<Row>(
      `SELECT ${selectColumns}
       FROM ${table}
       ${whereClause}
       ORDER BY "${safeOrderField}" ${orderDir}
       LIMIT $${acc.next++} OFFSET $${acc.next++}`,
      [...acc.params, perPage, page * perPage],
    );
    items = rows.map(mapRow);
  }

  const deltaCursor = config.includeDeltaCursor
    ? await readSignalStreamHeadCursor({ client, table, filters, applyFilters })
    : undefined;

  return {
    pagination: { total, page, perPage, hasMore: (page + 1) * perPage < total },
    ...responseItems(responseKey, items),
    ...(deltaCursor !== undefined ? { deltaCursor } : {}),
  };
}

export async function listSignalDelta<Filters, Row extends { cursorId?: unknown }, Item, Key extends string>(
  config: SignalListConfig<Filters, Row, Item, Key> & {
    after: string | undefined;
    limit: number;
  },
): Promise<
  {
    delta: { limit: number; hasMore: boolean };
    deltaCursor: string;
  } & SignalItems<Key, Item>
> {
  const { client, table, filters, selectColumns, responseKey, applyFilters, mapRow, after, limit } = config;

  if (after === undefined) {
    const deltaCursor = await readSignalStreamHeadCursor({ client, table, filters, applyFilters });
    return { ...responseItems(responseKey, []), delta: { limit, hasMore: false }, deltaCursor };
  }

  const afterId = validateCursorId(after);
  const acc = newFilterAccumulator();
  applyFilters(acc, filters);
  acc.conditions.push(`"cursorId" > $${acc.next++}::bigint`);
  acc.params.push(afterId);

  const rows = await client.manyOrNone<Row>(
    `SELECT ${selectColumns}
     FROM ${table}
     ${whereOrEmpty(acc)}
     ORDER BY "cursorId" ASC
     LIMIT $${acc.next++}`,
    [...acc.params, limit + 1],
  );

  const hasMore = rows.length > limit;
  const visible = rows.slice(0, limit);
  const deltaCursor =
    visible.length > 0
      ? encodeDeltaCursor(visible[visible.length - 1]!.cursorId)
      : await readSignalStreamHeadCursor({ client, table, filters, applyFilters });

  return {
    ...responseItems(responseKey, visible.map(mapRow)),
    delta: { limit, hasMore },
    deltaCursor,
  };
}
