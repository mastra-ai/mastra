import type { InValue } from '@libsql/client';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { AuditStorage, createStorageErrorId, TABLE_AUDIT_EVENTS, AUDIT_EVENTS_SCHEMA } from '@mastra/core/storage';
import type { AuditEvent, AuditFilter } from '@mastra/core/ee';
import type { AuditEventRecord } from '@mastra/core/storage';
import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';

/**
 * LibSQL implementation of audit event storage
 *
 * Stores audit events in a LibSQL database with full querying capabilities.
 */
export class AuditLibSQL extends AuditStorage {
  #db: LibSQLDB;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    this.#db = new LibSQLDB({ client, maxRetries: config.maxRetries, initialBackoffMs: config.initialBackoffMs });
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_AUDIT_EVENTS, schema: AUDIT_EVENTS_SCHEMA });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_AUDIT_EVENTS });
  }

  /**
   * Store a new audit event
   */
  async store(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<AuditEventRecord> {
    const id = crypto.randomUUID();
    const timestamp = new Date();
    const now = new Date();

    try {
      await this.#db.insert({
        tableName: TABLE_AUDIT_EVENTS,
        record: {
          id,
          timestamp: timestamp.toISOString(),
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

      const record: AuditEventRecord = {
        id,
        timestamp,
        ...event,
      };

      this.logger.debug(`AuditLibSQL: stored event ${id} - ${event.action} by ${event.actor.id}`);
      return record;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'AUDIT_STORE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { action: event.action },
        },
        error,
      );
    }
  }

  /**
   * Query audit events with filtering and pagination
   */
  async query(filter: AuditFilter): Promise<AuditEventRecord[]> {
    this.logger.debug('AuditLibSQL: querying audit events', filter);

    try {
      const { sql: whereClause, args } = this.buildWhereClause(filter);

      const offset = filter.offset ?? 0;
      const limit = filter.limit ?? 100;

      const rows = await this.#db.selectMany<Record<string, any>>({
        tableName: TABLE_AUDIT_EVENTS,
        whereClause: whereClause ? { sql: whereClause, args } : undefined,
        orderBy: '"timestamp" DESC',
        limit,
        offset,
      });

      return rows.map(row => this.parseRow(row));
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'AUDIT_QUERY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  /**
   * Get a single audit event by ID
   */
  async getById(id: string): Promise<AuditEventRecord | null> {
    this.logger.debug(`AuditLibSQL: getting event ${id}`);

    try {
      const result = await this.#db.select<Record<string, any>>({
        tableName: TABLE_AUDIT_EVENTS,
        keys: { id },
      });

      return result ? this.parseRow(result) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'AUDIT_GET_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
        },
        error,
      );
    }
  }

  /**
   * Get total count of audit events matching filter
   */
  async count(filter?: AuditFilter): Promise<number> {
    try {
      if (!filter) {
        return await this.#db.selectTotalCount({ tableName: TABLE_AUDIT_EVENTS });
      }

      const { sql: whereClause, args } = this.buildWhereClause(filter);
      return await this.#db.selectTotalCount({
        tableName: TABLE_AUDIT_EVENTS,
        whereClause: whereClause ? { sql: whereClause, args } : undefined,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'AUDIT_COUNT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  /**
   * Build WHERE clause from filter
   */
  private buildWhereClause(filter: AuditFilter): { sql: string; args: InValue[] } {
    const conditions: string[] = [];
    const args: InValue[] = [];

    if (filter.actorId) {
      conditions.push('"actorId" = ?');
      args.push(filter.actorId);
    }

    if (filter.actorType) {
      conditions.push('"actorType" = ?');
      args.push(filter.actorType);
    }

    if (filter.action) {
      if (filter.action.includes('*')) {
        // Convert wildcard to LIKE pattern
        const pattern = filter.action.replace(/\*/g, '%');
        conditions.push('"action" LIKE ?');
        args.push(pattern);
      } else {
        conditions.push('"action" = ?');
        args.push(filter.action);
      }
    }

    if (filter.resourceType) {
      conditions.push('"resourceType" = ?');
      args.push(filter.resourceType);
    }

    if (filter.resourceId) {
      conditions.push('"resourceId" = ?');
      args.push(filter.resourceId);
    }

    if (filter.outcome) {
      conditions.push('"outcome" = ?');
      args.push(filter.outcome);
    }

    if (filter.startDate) {
      conditions.push('"timestamp" >= ?');
      args.push(filter.startDate.toISOString());
    }

    if (filter.endDate) {
      conditions.push('"timestamp" <= ?');
      args.push(filter.endDate.toISOString());
    }

    const sql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return { sql, args };
  }

  /**
   * Parse database row to AuditEventRecord
   */
  private parseRow(row: Record<string, any>): AuditEventRecord {
    return {
      id: row.id as string,
      timestamp: new Date(row.timestamp as string),
      actor: {
        type: row.actorType as 'user' | 'system' | 'apikey',
        id: row.actorId as string,
        email: row.actorEmail as string | undefined,
        ip: row.actorIp as string | undefined,
        userAgent: row.actorUserAgent as string | undefined,
      },
      action: row.action as string,
      resource: row.resourceType
        ? {
            type: row.resourceType as string,
            id: row.resourceId as string,
            name: row.resourceName as string | undefined,
          }
        : undefined,
      outcome: row.outcome as 'success' | 'failure' | 'denied',
      metadata: row.metadata as Record<string, unknown> | undefined,
      duration: row.duration as number | undefined,
    };
  }
}
