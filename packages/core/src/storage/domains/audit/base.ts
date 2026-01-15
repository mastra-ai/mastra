/**
 * Base class for audit storage.
 *
 * Provides abstract methods for storing and querying audit events.
 * Implementations include in-memory (for development) and database-backed
 * storage adapters (Postgres, LibSQL, etc.).
 */

import { StorageDomain } from '../base';
import type {
  AuditEvent,
  AuditEventFilter,
  AuditEventPagination,
  CreateAuditEventInput,
  ListAuditEventsResponse,
} from './types';

/**
 * Abstract base class for audit event storage.
 *
 * @example
 * ```typescript
 * // Log an audit event
 * await auditStorage.logEvent({
 *   actor: { type: 'user', id: 'user-123', email: 'user@example.com' },
 *   action: 'agent.execute',
 *   resource: { type: 'agent', id: 'agent-456' },
 *   outcome: 'success',
 *   duration: 1234,
 * });
 *
 * // Query audit events
 * const { events } = await auditStorage.listEvents({
 *   filter: { actorId: 'user-123', actionPrefix: 'agent.' },
 *   pagination: { page: 0, perPage: 20 },
 * });
 * ```
 */
export abstract class AuditStorage extends StorageDomain {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'AUDIT',
    });
  }

  /**
   * Log an audit event.
   *
   * @param event - Event data (id and createdAt are auto-generated)
   * @returns The created audit event with id and createdAt
   */
  abstract logEvent(event: CreateAuditEventInput): Promise<AuditEvent>;

  /**
   * Get an audit event by ID.
   *
   * @param id - Event ID
   * @returns The audit event or null if not found
   */
  abstract getEventById(id: string): Promise<AuditEvent | null>;

  /**
   * List audit events with optional filtering and pagination.
   *
   * @param options - Filter and pagination options
   * @returns Paginated list of audit events
   */
  abstract listEvents(options: {
    filter?: AuditEventFilter;
    pagination: AuditEventPagination;
  }): Promise<ListAuditEventsResponse>;

  /**
   * Delete audit events matching a filter.
   * Useful for implementing retention policies.
   *
   * @param filter - Filter criteria for events to delete
   * @returns Number of events deleted
   */
  abstract deleteEvents(filter: AuditEventFilter): Promise<number>;

  /**
   * Clear all audit events.
   * Primarily used for testing.
   */
  abstract dangerouslyClearAll(): Promise<void>;
}
