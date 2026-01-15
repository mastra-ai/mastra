/**
 * In-memory implementation of audit storage.
 *
 * Stores audit events in memory. Useful for development and testing
 * but not suitable for production as events are lost on restart.
 */

import { calculatePagination, normalizePerPage } from '../../base';
import type { InMemoryDB } from '../inmemory-db';
import { AuditStorage } from './base';
import type {
  AuditEvent,
  AuditEventFilter,
  AuditEventPagination,
  CreateAuditEventInput,
  ListAuditEventsResponse,
} from './types';

export class AuditInMemory extends AuditStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  async logEvent(event: CreateAuditEventInput): Promise<AuditEvent> {
    const auditEvent: AuditEvent = {
      id: crypto.randomUUID(),
      createdAt: new Date(),
      ...event,
    };

    this.db.audit.set(auditEvent.id, auditEvent);
    return auditEvent;
  }

  async getEventById(id: string): Promise<AuditEvent | null> {
    return this.db.audit.get(id) ?? null;
  }

  async listEvents(options: {
    filter?: AuditEventFilter;
    pagination: AuditEventPagination;
  }): Promise<ListAuditEventsResponse> {
    const { filter, pagination } = options;

    // Get all events and apply filters
    let events = Array.from(this.db.audit.values());

    if (filter) {
      events = events.filter(event => this.matchesFilter(event, filter));
    }

    // Sort by createdAt descending (most recent first)
    events.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    // Apply pagination
    const { page, perPage: perPageInput } = pagination;
    const perPage = normalizePerPage(perPageInput, Number.MAX_SAFE_INTEGER);
    const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const end = perPageInput === false ? events.length : start + perPage;

    return {
      events: events.slice(start, end),
      pagination: {
        total: events.length,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : events.length > end,
      },
    };
  }

  async deleteEvents(filter: AuditEventFilter): Promise<number> {
    const events = Array.from(this.db.audit.values());
    let deletedCount = 0;

    for (const event of events) {
      if (this.matchesFilter(event, filter)) {
        this.db.audit.delete(event.id);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.audit.clear();
  }

  /**
   * Check if an event matches the given filter criteria.
   */
  private matchesFilter(event: AuditEvent, filter: AuditEventFilter): boolean {
    // Actor ID filter
    if (filter.actorId && event.actor.id !== filter.actorId) {
      return false;
    }

    // Actor type filter
    if (filter.actorType && event.actor.type !== filter.actorType) {
      return false;
    }

    // Action filter (exact match or array)
    if (filter.action) {
      const actions = Array.isArray(filter.action) ? filter.action : [filter.action];
      if (!actions.includes(event.action)) {
        return false;
      }
    }

    // Action prefix filter
    if (filter.actionPrefix && !event.action.startsWith(filter.actionPrefix)) {
      return false;
    }

    // Resource type filter
    if (filter.resourceType && event.resource?.type !== filter.resourceType) {
      return false;
    }

    // Resource ID filter
    if (filter.resourceId && event.resource?.id !== filter.resourceId) {
      return false;
    }

    // Outcome filter
    if (filter.outcome && event.outcome !== filter.outcome) {
      return false;
    }

    // Date range filters
    if (filter.startDate && event.createdAt < filter.startDate) {
      return false;
    }

    if (filter.endDate && event.createdAt > filter.endDate) {
      return false;
    }

    return true;
  }
}
