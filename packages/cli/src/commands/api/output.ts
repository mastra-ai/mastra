import type { ApiResponseShape } from './types.js';

interface PaginationInfo {
  total: number;
  page: number;
  perPage: number | false;
  hasMore: boolean;
}

const guardedStreams = new WeakSet<NodeJS.WritableStream>();

/**
 * `mastra api` writes its result once, after the request has finished. If the
 * reader already went away (`mastra api ... | head`), that write fails with
 * EPIPE, which Node would otherwise throw as an unhandled 'error' event and exit
 * 1 — turning a successful request into a failure. Nobody is reading anymore, so
 * drop the output and keep the request's exit code.
 */
function ignoreBrokenPipe(stream: NodeJS.WritableStream): void {
  if (guardedStreams.has(stream)) return;
  guardedStreams.add(stream);
  stream.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EPIPE') return;
    throw error;
  });
}

/**
 * Writes `value` as one JSON line. Only for one-shot output written after the work is done: the EPIPE
 * listener stays on the stream for the rest of the process, so a long-running command that reused this
 * would keep running after its reader left instead of stopping.
 */
export function writeJson(value: unknown, pretty: boolean, stream: NodeJS.WritableStream = process.stdout): void {
  ignoreBrokenPipe(stream);
  stream.write(`${JSON.stringify(value, null, pretty ? 2 : 0)}\n`);
}

export function normalizeSuccess(data: unknown, list: boolean, responseShape?: ApiResponseShape) {
  if (!list) return { data };

  const { items, page } = extractList(data, responseShape);
  return {
    data: items,
    page,
  };
}

function extractList(data: unknown, responseShape?: ApiResponseShape): { items: unknown[]; page: PaginationInfo } {
  if (Array.isArray(data)) {
    return { items: data, page: { total: data.length, page: 0, perPage: data.length, hasMore: false } };
  }

  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    const items = findArray(record, responseShape) ?? [];
    const nestedPage = record.page ?? record.pagination;
    const pageRecord = nestedPage && typeof nestedPage === 'object' ? (nestedPage as Record<string, unknown>) : record;
    return {
      items,
      page: normalizePage(pageRecord, items.length),
    };
  }

  return { items: [], page: { total: 0, page: 0, perPage: 0, hasMore: false } };
}

function normalizePage(pageRecord: Record<string, unknown> | undefined, itemCount: number): PaginationInfo {
  const total = typeof pageRecord?.total === 'number' ? pageRecord.total : itemCount;
  const page = typeof pageRecord?.page === 'number' ? pageRecord.page : 0;
  const perPage =
    typeof pageRecord?.perPage === 'number' || pageRecord?.perPage === false ? pageRecord.perPage : itemCount;
  const hasMore = typeof pageRecord?.hasMore === 'boolean' ? pageRecord.hasMore : false;

  return { total, page, perPage, hasMore };
}

function findArray(record: Record<string, unknown>, responseShape?: ApiResponseShape): unknown[] | undefined {
  if (responseShape?.kind === 'array' && Array.isArray(record)) return record;
  if (responseShape?.kind === 'record') return Object.values(record);
  if (responseShape?.kind === 'object-property' && responseShape.listProperty) {
    const value = record[responseShape.listProperty];
    if (Array.isArray(value)) return value;
  }

  if (Array.isArray(record.data)) return record.data;

  const values = Object.values(record);
  if (values.every(value => value && typeof value === 'object' && !Array.isArray(value))) {
    return values;
  }

  for (const value of values) {
    if (Array.isArray(value)) return value;
  }
  return undefined;
}
