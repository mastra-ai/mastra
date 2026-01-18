/**
 * Audit log types for the playground UI
 */

export type AuditActorType = 'user' | 'system' | 'apikey';
export type AuditOutcome = 'success' | 'failure' | 'denied';
export type AuditExportFormat = 'json' | 'csv';

export interface AuditActor {
  type: AuditActorType;
  id: string;
  email?: string;
  ip?: string;
  userAgent?: string;
}

export interface AuditResource {
  type: string;
  id: string;
  name?: string;
}

export interface AuditEvent {
  id: string;
  timestamp: Date;
  actor: AuditActor;
  action: string;
  resource?: AuditResource;
  outcome: AuditOutcome;
  metadata?: Record<string, unknown>;
  duration?: number;
}

export interface AuditFilter {
  actorId?: string;
  actorType?: AuditActorType;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  outcome?: AuditOutcome;
  startDate?: Date;
  endDate?: Date;
  offset?: number;
  limit?: number;
}

export interface AuditListResponse {
  events: AuditEvent[];
  total: number;
  offset: number;
  limit: number;
}
