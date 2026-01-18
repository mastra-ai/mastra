/**
 * Audit logging interfaces for security event tracking and compliance.
 *
 * Provides interfaces for logging security events, tracking user actions,
 * and maintaining audit trails for compliance requirements.
 */

/**
 * Type of actor performing an action
 */
export type AuditActorType = 'user' | 'system' | 'apikey';

/**
 * Outcome of an audited action
 */
export type AuditOutcome = 'success' | 'failure' | 'denied';

/**
 * Actor who performed an action
 */
export interface AuditActor {
  /**
   * Type of actor
   */
  type: AuditActorType;

  /**
   * Unique identifier of the actor
   */
  id: string;

  /**
   * Email address of the actor (if applicable)
   */
  email?: string;

  /**
   * IP address from which the action was performed
   */
  ip?: string;

  /**
   * User agent string of the client
   */
  userAgent?: string;
}

/**
 * Resource that was acted upon
 */
export interface AuditResource {
  /**
   * Type of resource (e.g., 'agent', 'workflow', 'tool')
   */
  type: string;

  /**
   * Unique identifier of the resource
   */
  id: string;

  /**
   * Optional display name of the resource
   */
  name?: string;
}

/**
 * Audit event record
 */
export interface AuditEvent {
  /**
   * Unique identifier for the audit event
   */
  id: string;

  /**
   * Timestamp when the event occurred
   */
  timestamp: Date;

  /**
   * Actor who performed the action
   */
  actor: AuditActor;

  /**
   * Action that was performed (e.g., 'agents:create', 'workflows:execute', 'settings:update')
   */
  action: string;

  /**
   * Resource that was acted upon (optional)
   */
  resource?: AuditResource;

  /**
   * Outcome of the action
   */
  outcome: AuditOutcome;

  /**
   * Additional metadata about the event
   */
  metadata?: Record<string, unknown>;

  /**
   * Duration of the action in milliseconds (optional)
   */
  duration?: number;
}

/**
 * Filter for querying audit events
 */
export interface AuditFilter {
  /**
   * Filter by actor ID
   */
  actorId?: string;

  /**
   * Filter by actor type
   */
  actorType?: AuditActorType;

  /**
   * Filter by action pattern (e.g., 'agents:*', 'workflows:execute')
   */
  action?: string;

  /**
   * Filter by resource type
   */
  resourceType?: string;

  /**
   * Filter by resource ID
   */
  resourceId?: string;

  /**
   * Filter by outcome
   */
  outcome?: AuditOutcome;

  /**
   * Filter by date range - start
   */
  startDate?: Date;

  /**
   * Filter by date range - end
   */
  endDate?: Date;

  /**
   * Pagination offset
   */
  offset?: number;

  /**
   * Pagination limit
   */
  limit?: number;
}

/**
 * Export format for audit logs
 */
export type AuditExportFormat = 'json' | 'csv';

/**
 * Audit logger interface for recording security events
 */
export interface IAuditLogger {
  /**
   * Log an audit event
   *
   * @param event - The event to log (without id and timestamp which are generated)
   */
  log(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void>;

  /**
   * Query audit events (optional capability)
   *
   * @param filter - Filter criteria for querying events
   * @returns Array of matching audit events
   */
  query?(filter: AuditFilter): Promise<AuditEvent[]>;

  /**
   * Export audit events (optional capability)
   *
   * @param filter - Filter criteria for events to export
   * @param format - Export format (json or csv)
   * @returns ReadableStream of exported data
   */
  export?(filter: AuditFilter, format: AuditExportFormat): Promise<ReadableStream>;
}
