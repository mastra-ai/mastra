/**
 * WorkOS Audit Logs Provider.
 *
 * Exports Mastra audit events to WorkOS Audit Logs for enterprise SIEM integration.
 * Implements MastraAuditProvider interface for use with Mastra's audit system.
 *
 * Allows enterprise customers to:
 * - View Mastra events in WorkOS Admin Portal
 * - Export to SIEM systems (Splunk, Datadog, etc.)
 * - Meet compliance requirements (SOC 2, HIPAA, etc.)
 *
 * @see https://workos.com/docs/audit-logs
 */

import type { WorkOS } from '@workos-inc/node';
import type { AuditEvent } from '@mastra/core/storage';
import type { MastraAuditProvider } from '@mastra/core/server';

import { DEFAULT_AUDIT_ACTION_MAPPING, type WorkOSAuditExporterOptions } from './types';

/**
 * Options for creating an audit log export from WorkOS.
 */
export interface CreateExportOptions {
  /** Organization ID to export logs for */
  organizationId: string;
  /** Start date for the export range */
  startDate: Date;
  /** End date for the export range */
  endDate: Date;
  /** Filter by specific actions */
  actions?: string[];
  /** Filter by specific actor IDs */
  actors?: string[];
}

/**
 * Result from creating or retrieving an audit log export.
 */
export interface AuditExportResult {
  /** Export ID */
  id: string;
  /** URL to download the CSV export (expires after 10 minutes) */
  url?: string;
  /** Current state of the export: 'pending', 'ready', or 'error' */
  state: string;
}

/**
 * WorkOS Audit Provider for Mastra.
 *
 * This class implements MastraAuditProvider to bridge Mastra's audit system
 * with WorkOS Audit Logs, enabling enterprise customers to centralize their
 * audit trail and integrate with SIEM platforms.
 *
 * @example
 * ```typescript
 * import { WorkOS } from '@workos-inc/node';
 * import { WorkOSAuditProvider } from '@mastra/auth-workos';
 *
 * const workos = new WorkOS(process.env.WORKOS_API_KEY);
 * const auditProvider = new WorkOSAuditProvider(workos, {
 *   organizationId: 'org_123',
 * });
 *
 * // Use as Mastra audit provider
 * const mastra = new Mastra({
 *   server: {
 *     audit: auditProvider,
 *   },
 * });
 * ```
 */
export class WorkOSAuditProvider implements MastraAuditProvider {
  private workos: WorkOS;
  private defaultOrganizationId?: string;
  private actionMapping: Record<string, string>;

  /**
   * Creates a new WorkOSAuditProvider instance.
   *
   * @param workos - WorkOS client instance
   * @param options - Configuration options (optional)
   */
  constructor(workos: WorkOS, options?: WorkOSAuditExporterOptions) {
    this.workos = workos;
    this.defaultOrganizationId = options?.organizationId;
    this.actionMapping = options?.actionMapping ?? DEFAULT_AUDIT_ACTION_MAPPING;
  }

  /**
   * Log an audit event to WorkOS Audit Logs.
   *
   * Maps Mastra's AuditEvent format to WorkOS's audit log format:
   * - action: Mapped via actionMapping (falls back to original action if unmapped)
   * - actor: Converted to WorkOS actor format with type, id, and name
   * - targets: Resource converted to WorkOS target format
   * - context: IP address and user agent from actor
   * - metadata: Outcome, duration, and any additional metadata
   *
   * @param event - The Mastra audit event to log
   *
   * @example
   * ```typescript
   * await provider.logEvent({
   *   id: 'evt_123',
   *   createdAt: new Date(),
   *   actor: { type: 'user', id: 'user_123', email: 'alice@example.com' },
   *   action: 'agents.execute',
   *   resource: { type: 'agent', id: 'agent_456', name: 'Support Agent' },
   *   outcome: 'success',
   *   duration: 1500,
   * });
   * ```
   */
  async logEvent(event: AuditEvent): Promise<void> {
    // Get organization ID from event actor or fall back to default
    const organizationId = event.actor.organizationId ?? this.defaultOrganizationId;
    if (!organizationId) {
      // Skip logging if no organization ID available
      console.warn('[WorkOSAuditProvider] Skipping audit event - no organizationId in actor or default config');
      return;
    }

    // Map the action using the configured mapping, or use the original action
    const action = this.actionMapping[event.action] ?? event.action;

    // Build the targets array from the resource if present
    const targets: Array<{ type: string; id: string; name?: string }> = [];
    if (event.resource) {
      targets.push({
        type: event.resource.type,
        id: event.resource.id,
        ...(event.resource.name && { name: event.resource.name }),
      });
    }

    // Build context from actor's IP and user agent (location is required by WorkOS)
    const context: { location: string; userAgent?: string } = {
      location: event.actor.ip ?? 'unknown',
    };
    if (event.actor.userAgent) {
      context.userAgent = event.actor.userAgent;
    }

    // Build metadata including outcome, duration, and any additional metadata
    // WorkOS only accepts string | number | boolean values
    const metadata: Record<string, string | number | boolean> = {
      outcome: event.outcome,
    };
    if (event.duration !== undefined) {
      metadata.duration = event.duration;
    }
    // Copy over additional metadata, filtering to only allowed types
    if (event.metadata) {
      for (const [key, value] of Object.entries(event.metadata)) {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          metadata[key] = value;
        }
      }
    }

    await this.workos.auditLogs.createEvent(organizationId, {
      action,
      occurredAt: event.createdAt,
      actor: {
        type: event.actor.type === 'user' ? 'user' : 'system',
        id: event.actor.id,
        ...(event.actor.email && { name: event.actor.email }),
      },
      targets,
      context,
      metadata,
    });
  }

  /**
   * Exports multiple Mastra audit events to WorkOS Audit Logs.
   *
   * Processes events sequentially to avoid rate limiting.
   * For large batches, consider implementing rate limiting or batching on the caller side.
   *
   * @param events - Array of Mastra audit events to export
   *
   * @example
   * ```typescript
   * // Backfill historical events
   * const historicalEvents = await auditStorage.listEvents({
   *   startDate: new Date('2024-01-01'),
   *   endDate: new Date('2024-06-01'),
   * });
   * await exporter.exportEvents(historicalEvents);
   * ```
   */
  async exportEvents(events: AuditEvent[]): Promise<void> {
    for (const event of events) {
      await this.logEvent(event);
    }
  }

  /**
   * Creates a CSV export of audit logs from WorkOS.
   *
   * The export is created asynchronously. Use getExport() to poll for completion
   * and retrieve the download URL.
   *
   * @param options - Export configuration
   * @returns Export result with ID and initial state
   *
   * @example
   * ```typescript
   * // Create an export for Q1 2024
   * const { id, state } = await exporter.createExport({
   *   startDate: new Date('2024-01-01'),
   *   endDate: new Date('2024-03-31'),
   *   actions: ['user.logged_in', 'agent.executed'],
   * });
   *
   * // Poll for completion
   * let result = await exporter.getExport(id);
   * while (result.state === 'pending') {
   *   await new Promise(resolve => setTimeout(resolve, 1000));
   *   result = await exporter.getExport(id);
   * }
   *
   * if (result.url) {
   *   console.log('Download URL:', result.url);
   * }
   * ```
   */
  async createExport(options: CreateExportOptions): Promise<AuditExportResult> {
    const exportResult = await this.workos.auditLogs.createExport({
      organizationId: options.organizationId,
      rangeStart: options.startDate,
      rangeEnd: options.endDate,
      ...(options.actions && { actions: options.actions }),
      ...(options.actors && { actors: options.actors }),
    });

    return {
      id: exportResult.id,
      url: exportResult.url ?? undefined,
      state: exportResult.state,
    };
  }

  /**
   * Gets the status and download URL of an audit log export.
   *
   * The download URL expires after 10 minutes. If expired, create a new export.
   *
   * Export states:
   * - 'pending': Export is being generated
   * - 'ready': Export is ready for download
   * - 'error': Export failed
   *
   * @param exportId - The export ID returned from createExport()
   * @returns Export result with current state and URL (if ready)
   *
   * @example
   * ```typescript
   * const result = await exporter.getExport('audit_export_123');
   * if (result.state === 'ready' && result.url) {
   *   // Download the CSV file
   *   const response = await fetch(result.url);
   *   const csv = await response.text();
   * }
   * ```
   */
  async getExport(exportId: string): Promise<Omit<AuditExportResult, 'id'>> {
    const exportResult = await this.workos.auditLogs.getExport(exportId);

    return {
      url: exportResult.url ?? undefined,
      state: exportResult.state,
    };
  }
}
