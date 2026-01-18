import type { AuditEvent, AuditFilter } from '../../../ee/interfaces/audit.js';
import type { InMemoryDB } from '../inmemory-db.js';
import { AuditStorage } from './base.js';
import type { AuditEventRecord } from './types.js';

/**
 * In-memory implementation of audit event storage
 *
 * Stores audit events in memory using a Map. Suitable for development and testing only.
 * Events are lost when the process restarts.
 */
export class InMemoryAuditStorage extends AuditStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  /**
   * Clears all audit events from memory
   */
  async dangerouslyClearAll(): Promise<void> {
    this.db.auditEvents.clear();
  }

  /**
   * Store a new audit event
   */
  async store(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<AuditEventRecord> {
    const id = crypto.randomUUID();
    const timestamp = new Date();

    const record: AuditEventRecord = {
      id,
      timestamp,
      ...event,
    };

    this.db.auditEvents.set(id, record);
    this.logger.debug(`InMemoryAuditStorage: stored event ${id} - ${event.action} by ${event.actor.id}`);

    return record;
  }

  /**
   * Query audit events with filtering and pagination
   */
  async query(filter: AuditFilter): Promise<AuditEventRecord[]> {
    this.logger.debug('InMemoryAuditStorage: querying audit events', filter);

    let events = Array.from(this.db.auditEvents.values());

    // Apply filters
    events = this.applyFilters(events, filter);

    // Apply pagination
    const offset = filter.offset || 0;
    const limit = filter.limit || 100;

    return events.slice(offset, offset + limit);
  }

  /**
   * Get a single audit event by ID
   */
  async getById(id: string): Promise<AuditEventRecord | null> {
    this.logger.debug(`InMemoryAuditStorage: getting event ${id}`);
    return this.db.auditEvents.get(id) || null;
  }

  /**
   * Get total count of audit events matching filter
   */
  async count(filter?: AuditFilter): Promise<number> {
    if (!filter) {
      return this.db.auditEvents.size;
    }

    const events = Array.from(this.db.auditEvents.values());
    const filtered = this.applyFilters(events, filter);
    return filtered.length;
  }

  /**
   * Apply filters to audit events
   */
  private applyFilters(events: AuditEventRecord[], filter: AuditFilter): AuditEventRecord[] {
    let filtered = events;

    // Filter by actor ID
    if (filter.actorId) {
      filtered = filtered.filter(e => e.actor.id === filter.actorId);
    }

    // Filter by actor type
    if (filter.actorType) {
      filtered = filtered.filter(e => e.actor.type === filter.actorType);
    }

    // Filter by action (supports wildcards)
    if (filter.action) {
      if (filter.action.includes('*')) {
        // Escape regex metacharacters before converting wildcards to avoid ReDoS
        const escaped = filter.action.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
        // Convert wildcard pattern to regex
        const pattern = escaped.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`);
        filtered = filtered.filter(e => regex.test(e.action));
      } else {
        // Exact match
        filtered = filtered.filter(e => e.action === filter.action);
      }
    }

    // Filter by resource type
    if (filter.resourceType) {
      filtered = filtered.filter(e => e.resource?.type === filter.resourceType);
    }

    // Filter by resource ID
    if (filter.resourceId) {
      filtered = filtered.filter(e => e.resource?.id === filter.resourceId);
    }

    // Filter by outcome
    if (filter.outcome) {
      filtered = filtered.filter(e => e.outcome === filter.outcome);
    }

    // Filter by date range
    if (filter.startDate) {
      filtered = filtered.filter(e => e.timestamp >= filter.startDate!);
    }

    if (filter.endDate) {
      filtered = filtered.filter(e => e.timestamp <= filter.endDate!);
    }

    // Sort by timestamp (newest first)
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return filtered;
  }
}
