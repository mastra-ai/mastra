/**
 * Audit logger interface for EE authentication.
 * Enables activity tracking in Studio.
 */

import type { ResourceIdentifier } from './acl';

/**
 * Actor who performed an audited action.
 */
export interface AuditActor {
  /** Actor type */
  type: 'user' | 'system' | 'apikey';
  /** Actor identifier */
  id: string;
  /** Actor email (for users) */
  email?: string;
  /** IP address of the request */
  ip?: string;
  /** User agent of the request */
  userAgent?: string;
}

/**
 * An audit event record.
 */
export interface AuditEvent {
  /** Event ID (assigned by logger) */
  id?: string;
  /** When the event occurred */
  timestamp: Date;
  /** Who performed the action */
  actor: AuditActor;
  /** Action performed (e.g., 'auth.login', 'agent.execute', 'acl.grant') */
  action: string;
  /** Resource affected (if applicable) */
  resource?: ResourceIdentifier;
  /** Outcome of the action */
  outcome: 'success' | 'failure' | 'denied';
  /** Additional event metadata */
  metadata?: Record<string, unknown>;
  /** Duration of the action in milliseconds */
  duration?: number;
}

/**
 * Filter criteria for querying audit events.
 */
export interface AuditFilter {
  /** Filter by actor ID */
  actorId?: string;
  /** Filter by actor type */
  actorType?: AuditActor['type'];
  /** Filter by action (string or array of strings) */
  action?: string | string[];
  /** Filter by resource type */
  resourceType?: string;
  /** Filter by resource ID */
  resourceId?: string;
  /** Filter by outcome */
  outcome?: AuditEvent['outcome'];
  /** Filter events after this time */
  startTime?: Date;
  /** Filter events before this time */
  endTime?: Date;
  /** Maximum number of events to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Logger interface for audit events.
 *
 * Implement this interface to enable:
 * - Activity logging for compliance
 * - Audit log viewer in settings
 * - Security event tracking
 *
 * @example
 * ```typescript
 * class DatabaseAuditLogger implements IAuditLogger {
 *   async log(event) {
 *     await this.db.insert('audit_events', {
 *       id: crypto.randomUUID(),
 *       timestamp: new Date(),
 *       ...event,
 *     });
 *   }
 *
 *   async query(filter) {
 *     let query = this.db.select('audit_events');
 *     if (filter.actorId) query = query.where('actor_id', filter.actorId);
 *     if (filter.action) query = query.where('action', filter.action);
 *     if (filter.startTime) query = query.where('timestamp', '>=', filter.startTime);
 *     if (filter.endTime) query = query.where('timestamp', '<=', filter.endTime);
 *     return query.limit(filter.limit ?? 100).offset(filter.offset ?? 0);
 *   }
 * }
 * ```
 */
export interface IAuditLogger {
  /**
   * Log an audit event.
   *
   * @param event - Event to log (id and timestamp will be added)
   */
  log(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void>;

  /**
   * Optional: Query audit events.
   *
   * @param filter - Filter criteria
   * @returns Array of matching events
   */
  query?(filter: AuditFilter): Promise<AuditEvent[]>;

  /**
   * Optional: Export audit events.
   *
   * @param filter - Filter criteria
   * @param format - Export format
   * @returns Readable stream of exported data
   */
  export?(filter: AuditFilter, format: 'json' | 'csv'): Promise<ReadableStream>;
}
