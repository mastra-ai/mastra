import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  listTracesArgsSchema,
  ObservabilityStorage,
  TABLE_SPANS,
  toTraceSpans,
  TraceStatus,
} from '@mastra/core/storage';
import type {
  BatchCreateSpansArgs,
  BatchDeleteTracesArgs,
  BatchUpdateSpansArgs,
  CreateSpanArgs,
  GetRootSpanArgs,
  GetRootSpanResponse,
  GetSpanArgs,
  GetSpanResponse,
  GetTraceArgs,
  GetTraceLightResponse,
  GetTraceResponse,
  ListTracesArgs,
  ListTracesResponse,
  SpanRecord,
  TracingStorageStrategy,
  UpdateSpanArgs,
} from '@mastra/core/storage';
import { SurrealDBConnector } from '../../../shared/connector';
import type { SurrealDBDomainConfig } from '../../../shared/connector';
import { OBSERVABILITY_SCHEMA } from '../../schema';
import { toDate, toOptionalDate, totalFrom } from '../utils';

/** `mastra_ai_spans:[traceId, spanId]` */
const SPAN_RECORD = `type::record('${TABLE_SPANS}', [$traceId, $spanId])`;

const HEAVY_FIELDS = 'input, output, attributes, metadata, tags, links';

/** Filters handled explicitly; every other filter key is matched by equality on the root span. */
const SPECIAL_FILTERS = new Set(['startedAt', 'endedAt', 'status', 'hasChildError', 'metadata', 'scope', 'tags']);

const SAFE_FIELD = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** `NONE` and `NULL` both mean "not set". */
function isSet(field: string): string {
  return `(${field} != NONE AND ${field} != NULL)`;
}

/** Spans are stored as plain JSON values with native datetimes for the time fields. */
function toSpanContent(span: Partial<SpanRecord>): Record<string, unknown> {
  const content = JSON.parse(JSON.stringify(span)) as Record<string, unknown>;
  if (span.startedAt != null) content.startedAt = toDate(span.startedAt);
  if (span.endedAt != null) content.endedAt = toDate(span.endedAt);
  return content;
}

function parseSpan(row: Record<string, unknown>): SpanRecord {
  const { id: _id, _running, ...span } = row;
  return {
    ...span,
    startedAt: toDate(span.startedAt),
    endedAt: span.endedAt == null ? (span.endedAt as null | undefined) : toDate(span.endedAt),
    createdAt: toDate(span.createdAt),
    updatedAt: toOptionalDate(span.updatedAt) ?? null,
  } as SpanRecord;
}

export class ObservabilityStorageSurrealDB extends ObservabilityStorage {
  #connector: SurrealDBConnector;

  constructor(config: SurrealDBDomainConfig) {
    super();
    this.#connector = SurrealDBConnector.from(config);
  }

  async init(): Promise<void> {
    await this.#connector.ensureDatabase();
    await this.#connector.query(OBSERVABILITY_SCHEMA);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#connector.query(`DELETE ${TABLE_SPANS}`);
  }

  public override get tracingStrategy(): {
    preferred: TracingStorageStrategy;
    supported: TracingStorageStrategy[];
  } {
    return {
      preferred: 'batch-with-updates',
      supported: ['batch-with-updates', 'insert-only'],
    };
  }

  async createSpan({ span }: CreateSpanArgs): Promise<void> {
    try {
      const now = new Date();
      await this.#connector.query(
        `UPSERT ${SPAN_RECORD} CONTENT object::extend($span, { createdAt: $now, updatedAt: $now }) RETURN NONE`,
        { traceId: span.traceId, spanId: span.spanId, span: toSpanContent(span), now },
      );
    } catch (error) {
      throw this.#error('CREATE_SPAN', error, { traceId: span.traceId, spanId: span.spanId });
    }
  }

  async batchCreateSpans({ records }: BatchCreateSpansArgs): Promise<void> {
    if (records.length === 0) return;
    try {
      const now = new Date();
      // Exporters deliver at least once: a span that already exists is left as it is.
      await this.#connector.query(`INSERT IGNORE INTO ${TABLE_SPANS} $rows RETURN NONE`, {
        rows: records.map(span => ({
          ...toSpanContent(span),
          id: [span.traceId, span.spanId],
          createdAt: now,
          updatedAt: now,
        })),
      });
    } catch (error) {
      throw this.#error('BATCH_CREATE_SPANS', error);
    }
  }

  async getSpan({ traceId, spanId }: GetSpanArgs): Promise<GetSpanResponse | null> {
    try {
      const [row] = await this.#connector.query<[Record<string, unknown> | undefined]>(
        `SELECT * FROM ONLY ${SPAN_RECORD}`,
        { traceId, spanId },
      );
      return row ? { span: parseSpan(row) } : null;
    } catch (error) {
      throw this.#error('GET_SPAN', error, { traceId, spanId });
    }
  }

  async getRootSpan({ traceId }: GetRootSpanArgs): Promise<GetRootSpanResponse | null> {
    try {
      const [row] = await this.#connector.query<[Record<string, unknown> | undefined]>(
        `SELECT * FROM ONLY ${TABLE_SPANS} WHERE traceId = $traceId AND !${isSet('parentSpanId')} LIMIT 1`,
        { traceId },
      );
      return row ? { span: parseSpan(row) } : null;
    } catch (error) {
      throw this.#error('GET_ROOT_SPAN', error, { traceId });
    }
  }

  async getTrace({ traceId }: GetTraceArgs): Promise<GetTraceResponse | null> {
    try {
      const rows = await this.#connector.queryAll<Record<string, unknown>>(
        `SELECT * FROM ${TABLE_SPANS} WHERE traceId = $traceId ORDER BY startedAt ASC`,
        { traceId },
      );
      return rows.length > 0 ? { traceId, spans: rows.map(parseSpan) } : null;
    } catch (error) {
      throw this.#error('GET_TRACE', error, { traceId });
    }
  }

  async getTraceLight({ traceId }: GetTraceArgs): Promise<GetTraceLightResponse | null> {
    try {
      const rows = await this.#connector.queryAll<Record<string, unknown>>(
        `SELECT * OMIT ${HEAVY_FIELDS} FROM ${TABLE_SPANS} WHERE traceId = $traceId ORDER BY startedAt ASC`,
        { traceId },
      );
      return rows.length > 0 ? ({ traceId, spans: rows.map(parseSpan) } as GetTraceLightResponse) : null;
    } catch (error) {
      throw this.#error('GET_TRACE_LIGHT', error, { traceId });
    }
  }

  async updateSpan({ traceId, spanId, updates }: UpdateSpanArgs): Promise<void> {
    try {
      await this.#connector.query(`UPDATE ${SPAN_RECORD} MERGE $updates RETURN NONE`, {
        traceId,
        spanId,
        updates: { ...toSpanContent(updates), updatedAt: new Date() },
      });
    } catch (error) {
      throw this.#error('UPDATE_SPAN', error, { traceId, spanId });
    }
  }

  async batchUpdateSpans({ records }: BatchUpdateSpansArgs): Promise<void> {
    if (records.length === 0) return;
    try {
      const now = new Date();
      const bindings: Record<string, unknown> = {};
      const statements = records.map((record, i) => {
        bindings[`id${i}`] = [record.traceId, record.spanId];
        bindings[`u${i}`] = { ...toSpanContent(record.updates), updatedAt: now };
        return `UPDATE type::record('${TABLE_SPANS}', $id${i}) MERGE $u${i} RETURN NONE`;
      });
      await this.#connector.transaction(statements, bindings);
    } catch (error) {
      throw this.#error('BATCH_UPDATE_SPANS', error);
    }
  }

  async batchDeleteTraces(args: BatchDeleteTracesArgs): Promise<void> {
    this.assertUnscopedBatchDeleteTraces(args);
    if (args.traceIds.length === 0) return;
    try {
      await this.#connector.query(`DELETE ${TABLE_SPANS} WHERE traceId INSIDE $traceIds`, {
        traceIds: args.traceIds,
      });
    } catch (error) {
      throw this.#error('BATCH_DELETE_TRACES', error);
    }
  }

  async listTraces(args: ListTracesArgs): Promise<ListTracesResponse> {
    const { filters, pagination, orderBy } = listTracesArgsSchema.parse(args);
    const page = pagination?.page ?? 0;
    const perPage = pagination?.perPage ?? 10;

    try {
      const where = [`!${isSet('parentSpanId')}`];
      const bindings: Record<string, unknown> = { limit: perPage, offset: page * perPage };
      let n = 0;
      const bind = (value: unknown) => {
        const name = `f${n++}`;
        bindings[name] = value;
        return `$${name}`;
      };

      for (const [key, value] of Object.entries(filters ?? {})) {
        if (value === undefined || value === null || SPECIAL_FILTERS.has(key) || !SAFE_FIELD.test(key)) continue;
        where.push(`${key} = ${bind(value)}`);
      }

      for (const field of ['startedAt', 'endedAt'] as const) {
        const range = filters?.[field];
        if (range?.start) where.push(`${field} ${range.startExclusive ? '>' : '>='} ${bind(toDate(range.start))}`);
        if (range?.end) where.push(`${field} ${range.endExclusive ? '<' : '<='} ${bind(toDate(range.end))}`);
      }

      for (const field of ['metadata', 'scope'] as const) {
        for (const [key, value] of Object.entries(filters?.[field] ?? {})) {
          where.push(`${field}[${bind(key)}] = ${bind(value)}`);
        }
      }

      if (filters?.tags?.length) where.push(`tags CONTAINSALL ${bind(filters.tags)}`);

      switch (filters?.status) {
        case TraceStatus.ERROR:
          where.push(isSet('error'));
          break;
        case TraceStatus.RUNNING:
          where.push(`!${isSet('endedAt')} AND !${isSet('error')}`);
          break;
        case TraceStatus.SUCCESS:
          where.push(`${isSet('endedAt')} AND !${isSet('error')}`);
          break;
      }

      if (filters?.hasChildError !== undefined) {
        const hasError = `count((SELECT VALUE id FROM ${TABLE_SPANS} WHERE traceId = $parent.traceId AND ${isSet('error')} LIMIT 1)) > 0`;
        where.push(filters.hasChildError ? hasError : `!(${hasError})`);
      }

      // Running spans (no endedAt) sort as the newest when ordering by endedAt.
      const direction = orderBy?.direction === 'ASC' ? 'ASC' : 'DESC';
      const order =
        orderBy?.field === 'endedAt'
          ? `_running ${direction === 'DESC' ? 'DESC' : 'ASC'}, endedAt ${direction}`
          : `startedAt ${direction}`;

      const whereClause = `WHERE ${where.join(' AND ')}`;
      const [rows, count] = await this.#connector.query<[Record<string, unknown>[], unknown]>(
        `SELECT *, !${isSet('endedAt')} AS _running FROM ${TABLE_SPANS} ${whereClause} ORDER BY ${order} LIMIT $limit START $offset;
         SELECT count() AS count FROM ${TABLE_SPANS} ${whereClause} GROUP ALL;`,
        bindings,
      );
      const total = totalFrom(count);

      return {
        pagination: { total, page, perPage, hasMore: (page + 1) * perPage < total },
        spans: toTraceSpans(rows.map(parseSpan)),
      };
    } catch (error) {
      throw this.#error('LIST_TRACES', error);
    }
  }

  #error(operation: string, error: unknown, details?: Record<string, string | number>): MastraError {
    if (error instanceof MastraError) return error;
    return new MastraError(
      {
        id: createStorageErrorId('SURREALDB', operation, 'FAILED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.THIRD_PARTY,
        details,
      },
      error,
    );
  }
}
