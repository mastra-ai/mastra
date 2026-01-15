/**
 * Audit storage types.
 *
 * These types define the structure for audit events stored in Mastra's storage layer.
 */

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
  /** Organization ID (for multi-tenant systems like WorkOS) */
  organizationId?: string;
  /** IP address of the request */
  ip?: string;
  /** User agent of the request */
  userAgent?: string;
}

/**
 * Resource affected by an audited action.
 */
export interface AuditResource {
  /** Resource type (e.g., 'agent', 'workflow', 'thread') */
  type: string;
  /** Resource identifier */
  id: string;
  /** Optional resource name for display */
  name?: string;
}

/**
 * An audit event record.
 */
export interface AuditEvent {
  /** Event ID */
  id: string;
  /** When the event occurred */
  createdAt: Date;
  /** Who performed the action */
  actor: AuditActor;
  /** Action performed (e.g., 'auth.login', 'agent.execute', 'workflow.run') */
  action: string;
  /** Resource affected (if applicable) */
  resource?: AuditResource;
  /** Outcome of the action */
  outcome: 'success' | 'failure' | 'denied';
  /** Additional event metadata */
  metadata?: Record<string, unknown>;
  /** Duration of the action in milliseconds */
  duration?: number;
}

/**
 * Input for creating an audit event (id and createdAt are auto-generated).
 */
export type CreateAuditEventInput = Omit<AuditEvent, 'id' | 'createdAt'>;

/**
 * Filter criteria for querying audit events.
 */
export interface AuditEventFilter {
  /** Filter by actor ID */
  actorId?: string;
  /** Filter by actor type */
  actorType?: AuditActor['type'];
  /** Filter by action (exact match or array of actions) */
  action?: string | string[];
  /** Filter by action prefix (e.g., 'auth.' matches 'auth.login', 'auth.logout') */
  actionPrefix?: string;
  /** Filter by resource type */
  resourceType?: string;
  /** Filter by resource ID */
  resourceId?: string;
  /** Filter by outcome */
  outcome?: AuditEvent['outcome'];
  /** Filter events after this time */
  startDate?: Date;
  /** Filter events before this time */
  endDate?: Date;
}

/**
 * Pagination options for listing audit events.
 */
export interface AuditEventPagination {
  /** Page number (0-indexed) */
  page: number;
  /** Items per page, or false to return all */
  perPage: number | false;
}

/**
 * Response from listing audit events.
 */
export interface ListAuditEventsResponse {
  events: AuditEvent[];
  pagination: {
    total: number;
    page: number;
    perPage: number | false;
    hasMore: boolean;
  };
}
