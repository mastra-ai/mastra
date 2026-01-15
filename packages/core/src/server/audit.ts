/**
 * Audit logging service for the server.
 *
 * Provides a simple interface for logging audit events based on server configuration.
 */

import type { Mastra } from '../mastra';
import type { AuditConfig, ServerConfig } from './types';
import type { CreateAuditEventInput, AuditActor, AuditResource } from '../storage/domains/audit';

/**
 * Normalized audit configuration with defaults applied.
 */
export interface NormalizedAuditConfig {
  enabled: boolean;
  events: {
    auth: boolean;
    agents: boolean;
    workflows: boolean;
    tools: boolean;
    permissions: boolean;
  };
  retention?: {
    days?: number;
  };
}

/**
 * Normalize audit config from server config.
 * Handles `true` (enable all) vs config object.
 */
export function normalizeAuditConfig(config: true | AuditConfig | undefined): NormalizedAuditConfig {
  if (!config) {
    return {
      enabled: false,
      events: {
        auth: false,
        agents: false,
        workflows: false,
        tools: false,
        permissions: false,
      },
    };
  }

  if (config === true) {
    // Enable all events with defaults
    return {
      enabled: true,
      events: {
        auth: true,
        agents: true,
        workflows: true,
        tools: true,
        permissions: true,
      },
    };
  }

  // Custom config - apply defaults for unspecified events
  return {
    enabled: true,
    events: {
      auth: config.events?.auth ?? true,
      agents: config.events?.agents ?? true,
      workflows: config.events?.workflows ?? true,
      tools: config.events?.tools ?? true,
      permissions: config.events?.permissions ?? true,
    },
    retention: config.retention,
  };
}

/**
 * Event categories for audit logging.
 */
export type AuditEventCategory = 'auth' | 'agents' | 'workflows' | 'tools' | 'permissions';

/**
 * Audit logging service.
 *
 * @example
 * ```typescript
 * const auditService = new AuditService(mastra);
 *
 * await auditService.log('auth', {
 *   actor: { type: 'user', id: 'user-123', email: 'user@example.com' },
 *   action: 'auth.login',
 *   outcome: 'success',
 * });
 * ```
 */
export class AuditService {
  private mastra: Mastra;
  private config: NormalizedAuditConfig;

  constructor(mastra: Mastra) {
    this.mastra = mastra;
    const serverConfig = mastra.getServer?.() as ServerConfig | undefined;
    this.config = normalizeAuditConfig(serverConfig?.audit);
  }

  /**
   * Check if audit logging is enabled.
   */
  get isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Check if a specific event category should be logged.
   */
  shouldLog(category: AuditEventCategory): boolean {
    if (!this.config.enabled) return false;
    return this.config.events[category];
  }

  /**
   * Log an audit event.
   *
   * @param category - Event category (determines if event should be logged based on config)
   * @param event - Event data
   */
  async log(category: AuditEventCategory, event: CreateAuditEventInput): Promise<void> {
    if (!this.shouldLog(category)) return;

    const storage = this.mastra.getStorage?.();
    if (!storage) return;

    const auditStore = await storage.getStore('audit');
    if (!auditStore) return;

    try {
      await auditStore.logEvent(event);
    } catch (error) {
      // Log error but don't throw - audit logging should not break main flow
      this.mastra.getLogger?.().warn('Failed to log audit event', { error, event });
    }
  }

  /**
   * Helper to create an actor from request context.
   */
  static createActorFromUser(user: { id: string; email?: string }, request?: Request): AuditActor {
    return {
      type: 'user',
      id: user.id,
      email: user.email,
      ip: request?.headers.get('x-forwarded-for') ?? request?.headers.get('x-real-ip') ?? undefined,
      userAgent: request?.headers.get('user-agent') ?? undefined,
    };
  }

  /**
   * Helper to create a system actor.
   */
  static createSystemActor(): AuditActor {
    return {
      type: 'system',
      id: 'system',
    };
  }

  /**
   * Helper to create a resource identifier.
   */
  static createResource(type: string, id: string, name?: string): AuditResource {
    return { type, id, name };
  }
}

/**
 * Get audit service from mastra instance.
 * Creates a new instance each time - for stateless usage in handlers.
 */
export function getAuditService(mastra: Mastra): AuditService {
  return new AuditService(mastra);
}
