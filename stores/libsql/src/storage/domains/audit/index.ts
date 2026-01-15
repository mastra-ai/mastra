import type { Client, InValue } from '@libsql/client';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  TABLE_AUDIT,
  AUDIT_SCHEMA,
  AuditStorage,
  calculatePagination,
  normalizePerPage,
} from '@mastra/core/storage';
import type {
  AuditEvent,
  AuditEventFilter,
  AuditEventPagination,
  CreateAuditEventInput,
  ListAuditEventsResponse,
} from '@mastra/core/storage';
import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';
import { buildSelectColumns } from '../../db/utils';

export class AuditLibSQL extends AuditStorage {
  #db: LibSQLDB;
  #client: Client;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    this.#client = client;
    this.#db = new LibSQLDB({ client, maxRetries: config.maxRetries, initialBackoffMs: config.initialBackoffMs });
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_AUDIT, schema: AUDIT_SCHEMA });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_AUDIT });
  }

  async logEvent(event: CreateAuditEventInput): Promise<AuditEvent> {
    try {
      const id = crypto.randomUUID();
      const now = new Date();

      await this.#db.insert({
        tableName: TABLE_AUDIT,
        record: {
          id,
          actorType: event.actor.type,
          actorId: event.actor.id,
          actorEmail: event.actor.email ?? null,
          actorIp: event.actor.ip ?? null,
          actorUserAgent: event.actor.userAgent ?? null,
          action: event.action,
          resourceType: event.resource?.type ?? null,
          resourceId: event.resource?.id ?? null,
          resourceName: event.resource?.name ?? null,
          outcome: event.outcome,
          metadata: event.metadata ?? null,
          duration: event.duration ?? null,
          createdAt: now.toISOString(),
        },
      });

      return {
        id,
        createdAt: now,
        ...event,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LOG_AUDIT_EVENT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getEventById(id: string): Promise<AuditEvent | null> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_AUDIT)} FROM ${TABLE_AUDIT} WHERE id = ?`,
        args: [id],
      });
      return result.rows?.[0] ? this.transformRow(result.rows[0]) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_AUDIT_EVENT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async listEvents(options: {
    filter?: AuditEventFilter;
    pagination: AuditEventPagination;
  }): Promise<ListAuditEventsResponse> {
    try {
      const { filter, pagination } = options;
      const { page, perPage: perPageInput } = pagination;

      const conditions: string[] = [];
      const queryParams: InValue[] = [];

      // Build filter conditions
      if (filter?.actorId) {
        conditions.push('actorId = ?');
        queryParams.push(filter.actorId);
      }

      if (filter?.actorType) {
        conditions.push('actorType = ?');
        queryParams.push(filter.actorType);
      }

      if (filter?.action) {
        if (Array.isArray(filter.action)) {
          const placeholders = filter.action.map(() => '?').join(', ');
          conditions.push(`action IN (${placeholders})`);
          queryParams.push(...filter.action);
        } else {
          conditions.push('action = ?');
          queryParams.push(filter.action);
        }
      }

      if (filter?.actionPrefix) {
        conditions.push('action LIKE ?');
        queryParams.push(`${filter.actionPrefix}%`);
      }

      if (filter?.resourceType) {
        conditions.push('resourceType = ?');
        queryParams.push(filter.resourceType);
      }

      if (filter?.resourceId) {
        conditions.push('resourceId = ?');
        queryParams.push(filter.resourceId);
      }

      if (filter?.outcome) {
        conditions.push('outcome = ?');
        queryParams.push(filter.outcome);
      }

      if (filter?.startDate) {
        conditions.push('createdAt >= ?');
        queryParams.push(filter.startDate.toISOString());
      }

      if (filter?.endDate) {
        conditions.push('createdAt <= ?');
        queryParams.push(filter.endDate.toISOString());
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await this.#client.execute({
        sql: `SELECT COUNT(*) as count FROM ${TABLE_AUDIT} ${whereClause}`,
        args: queryParams,
      });
      const total = Number(countResult.rows?.[0]?.count ?? 0);

      if (total === 0) {
        return {
          events: [],
          pagination: {
            total: 0,
            page,
            perPage: perPageInput,
            hasMore: false,
          },
        };
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;
      const end = perPageInput === false ? total : start + perPage;

      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_AUDIT)} FROM ${TABLE_AUDIT} ${whereClause} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
        args: [...queryParams, limitValue, start],
      });

      const events = result.rows?.map(row => this.transformRow(row)) ?? [];

      return {
        events,
        pagination: {
          total,
          page,
          perPage: perPageForResponse,
          hasMore: end < total,
        },
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_AUDIT_EVENTS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async deleteEvents(filter: AuditEventFilter): Promise<number> {
    try {
      const conditions: string[] = [];
      const queryParams: InValue[] = [];

      // Build filter conditions
      if (filter.actorId) {
        conditions.push('actorId = ?');
        queryParams.push(filter.actorId);
      }

      if (filter.actorType) {
        conditions.push('actorType = ?');
        queryParams.push(filter.actorType);
      }

      if (filter.action) {
        if (Array.isArray(filter.action)) {
          const placeholders = filter.action.map(() => '?').join(', ');
          conditions.push(`action IN (${placeholders})`);
          queryParams.push(...filter.action);
        } else {
          conditions.push('action = ?');
          queryParams.push(filter.action);
        }
      }

      if (filter.actionPrefix) {
        conditions.push('action LIKE ?');
        queryParams.push(`${filter.actionPrefix}%`);
      }

      if (filter.resourceType) {
        conditions.push('resourceType = ?');
        queryParams.push(filter.resourceType);
      }

      if (filter.resourceId) {
        conditions.push('resourceId = ?');
        queryParams.push(filter.resourceId);
      }

      if (filter.outcome) {
        conditions.push('outcome = ?');
        queryParams.push(filter.outcome);
      }

      if (filter.startDate) {
        conditions.push('createdAt >= ?');
        queryParams.push(filter.startDate.toISOString());
      }

      if (filter.endDate) {
        conditions.push('createdAt <= ?');
        queryParams.push(filter.endDate.toISOString());
      }

      // If no conditions, don't delete anything (safety measure)
      if (conditions.length === 0) {
        return 0;
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      const result = await this.#client.execute({
        sql: `DELETE FROM ${TABLE_AUDIT} ${whereClause}`,
        args: queryParams,
      });

      return result.rowsAffected ?? 0;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_AUDIT_EVENTS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  /**
   * Transform a database row to an AuditEvent.
   */
  private transformRow(row: Record<string, unknown>): AuditEvent {
    return {
      id: row.id as string,
      createdAt: new Date(row.createdAt as string),
      actor: {
        type: row.actorType as 'user' | 'system' | 'apikey',
        id: row.actorId as string,
        email: (row.actorEmail as string) || undefined,
        ip: (row.actorIp as string) || undefined,
        userAgent: (row.actorUserAgent as string) || undefined,
      },
      action: row.action as string,
      resource: row.resourceType
        ? {
            type: row.resourceType as string,
            id: row.resourceId as string,
            name: (row.resourceName as string) || undefined,
          }
        : undefined,
      outcome: row.outcome as 'success' | 'failure' | 'denied',
      metadata: row.metadata ? (JSON.parse(row.metadata as string) as Record<string, unknown>) : undefined,
      duration: row.duration ? Number(row.duration) : undefined,
    };
  }
}
