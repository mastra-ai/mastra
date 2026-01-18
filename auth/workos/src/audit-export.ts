import type { WorkOS } from '@workos-inc/node';
import type { AuditEvent, AuditFilter, AuditExportFormat, IAuditLogger, AuditOutcome } from '@mastra/core/ee';

/**
 * Configuration for WorkOS Audit Export
 */
export interface WorkOSAuditExporterConfig {
  /**
   * WorkOS SDK instance
   */
  workos: WorkOS;

  /**
   * Organization ID to export audit logs for
   */
  organizationId: string;

  /**
   * Optional event prefix for filtering Mastra events
   * @default 'mastra'
   */
  eventPrefix?: string;
}

/**
 * WorkOS Audit Log event structure
 * Matches the CreateAuditLogEventOptions interface from @workos-inc/node
 */
interface WorkOSAuditLogEvent {
  action: string;
  occurredAt: Date;
  actor: {
    id: string;
    name?: string;
    type: 'user' | 'system';
    metadata?: Record<string, string>;
  };
  targets: Array<{
    id: string;
    type: string;
    name?: string;
    metadata?: Record<string, string>;
  }>;
  context: {
    location: string;
    user_agent?: string;
  };
  metadata?: Record<string, string>;
}

/**
 * WorkOS Audit Exporter
 *
 * Exports Mastra audit events to WorkOS Audit Logs for SIEM integration,
 * compliance reporting, and centralized security event monitoring.
 *
 * WorkOS Audit Logs provides:
 * - Tamper-proof event storage
 * - SIEM integration (Splunk, Datadog, etc.)
 * - Compliance exports (SOC 2, ISO 27001, HIPAA)
 * - Advanced filtering and search
 * - Long-term retention
 *
 * @example
 * ```typescript
 * const auditExporter = new WorkOSAuditExporter({
 *   workos: workosClient,
 *   organizationId: 'org_123',
 *   eventPrefix: 'mastra',
 * });
 *
 * // Log an event
 * await auditExporter.log({
 *   actor: {
 *     type: 'user',
 *     id: 'user_123',
 *     email: 'user@example.com',
 *     ip: '192.168.1.1',
 *   },
 *   action: 'agents:create',
 *   resource: {
 *     type: 'agent',
 *     id: 'agent_456',
 *     name: 'Customer Support Agent',
 *   },
 *   outcome: 'success',
 *   duration: 234,
 * });
 * ```
 */
export class WorkOSAuditExporter implements IAuditLogger {
  private config: WorkOSAuditExporterConfig;

  constructor(config: WorkOSAuditExporterConfig) {
    this.config = {
      eventPrefix: 'mastra',
      ...config,
    };
  }

  /**
   * Log an audit event to WorkOS Audit Logs
   */
  async log(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void> {
    const workosEvent = this.mapToWorkOSEvent(event);

    await this.config.workos.auditLogs.createEvent(this.config.organizationId, workosEvent);
  }

  /**
   * Query audit events from WorkOS Audit Logs
   *
   * Note: This method is a placeholder. WorkOS SDK v7 may not expose the Audit Logs
   * query API directly. For production use, query events via the WorkOS dashboard
   * or use SIEM integrations.
   */
  async query(filter: AuditFilter): Promise<AuditEvent[]> {
    // TODO: Implement when WorkOS SDK exposes the Audit Logs query API
    // For now, throw an error indicating this feature is not available
    throw new Error(
      'Audit log querying is not yet implemented. ' +
        'Query audit events via the WorkOS dashboard or SIEM integration.',
    );
  }

  /**
   * Export audit events from WorkOS Audit Logs
   *
   * Note: This method is a placeholder. For production use, export events via
   * the WorkOS dashboard or SIEM integrations (Splunk, Datadog, etc.).
   */
  async export(filter: AuditFilter, format: AuditExportFormat): Promise<ReadableStream> {
    // TODO: Implement when WorkOS SDK exposes the Audit Logs export API
    // For now, throw an error indicating this feature is not available
    throw new Error(
      'Audit log export is not yet implemented. ' + 'Export audit events via the WorkOS dashboard or SIEM integration.',
    );
  }

  /**
   * Map Mastra audit event to WorkOS Audit Log event
   */
  private mapToWorkOSEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): WorkOSAuditLogEvent {
    return {
      action: `${this.config.eventPrefix}.${event.action}`,
      occurredAt: new Date(),
      actor: {
        id: event.actor.id,
        name: event.actor.email,
        type: event.actor.type === 'user' ? 'user' : 'system',
        metadata: {
          email: event.actor.email || '',
          ip: event.actor.ip || '',
          user_agent: event.actor.userAgent || '',
          actor_type: event.actor.type,
        },
      },
      targets: event.resource
        ? [
            {
              id: event.resource.id,
              type: event.resource.type,
              name: event.resource.name,
            },
          ]
        : [],
      context: {
        location: event.actor.ip || 'unknown',
        user_agent: event.actor.userAgent,
      },
      metadata: {
        outcome: event.outcome,
        duration: event.duration?.toString() || '',
        ...this.flattenMetadata(event.metadata),
      },
    };
  }

  /**
   * Flatten nested metadata objects for WorkOS
   */
  private flattenMetadata(metadata?: Record<string, unknown>): Record<string, string> {
    if (!metadata) return {};

    const flattened: Record<string, string> = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        flattened[key] = String(value);
      } else if (value !== null && value !== undefined) {
        flattened[key] = JSON.stringify(value);
      }
    }
    return flattened;
  }
}
