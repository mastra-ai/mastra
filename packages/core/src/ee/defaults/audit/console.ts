/**
 * Console audit logger for development.
 */

import type { AuditEvent, IAuditLogger } from '../../interfaces';

/**
 * Options for ConsoleAuditLogger.
 */
export interface ConsoleAuditLoggerOptions {
  /** Prefix for log messages */
  prefix?: string;
  /** Only log certain outcomes */
  outcomes?: Array<'success' | 'failure' | 'denied'>;
  /** Only log certain actions (regex patterns) */
  actionPatterns?: RegExp[];
  /** Enable JSON output */
  json?: boolean;
}

/**
 * Console audit logger.
 *
 * Logs audit events to the console. Useful for development but not
 * suitable for production as logs are not persisted.
 *
 * @example
 * ```typescript
 * const audit = new ConsoleAuditLogger({
 *   prefix: '[AUDIT]',
 *   outcomes: ['failure', 'denied'], // Only log failures
 * });
 * ```
 */
export class ConsoleAuditLogger implements IAuditLogger {
  private prefix: string;
  private outcomes?: Set<string>;
  private actionPatterns?: RegExp[];
  private json: boolean;

  constructor(options: ConsoleAuditLoggerOptions = {}) {
    this.prefix = options.prefix ?? '[audit]';
    this.outcomes = options.outcomes ? new Set(options.outcomes) : undefined;
    this.actionPatterns = options.actionPatterns;
    this.json = options.json ?? false;
  }

  async log(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void> {
    // Filter by outcome
    if (this.outcomes && !this.outcomes.has(event.outcome)) {
      return;
    }

    // Filter by action pattern
    if (this.actionPatterns) {
      const matches = this.actionPatterns.some(pattern => pattern.test(event.action));
      if (!matches) return;
    }

    const fullEvent: AuditEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ...event,
    };

    if (this.json) {
      console.log(JSON.stringify(fullEvent));
      return;
    }

    // Format for console output
    const parts = [
      this.prefix,
      this.formatTimestamp(fullEvent.timestamp),
      this.formatOutcome(fullEvent.outcome),
      this.formatActor(fullEvent.actor),
      fullEvent.action,
    ];

    if (fullEvent.resource) {
      parts.push(`on ${fullEvent.resource.type}:${fullEvent.resource.id}`);
    }

    if (fullEvent.duration !== undefined) {
      parts.push(`(${fullEvent.duration}ms)`);
    }

    const message = parts.join(' ');

    // Log based on outcome
    switch (fullEvent.outcome) {
      case 'failure':
        console.error(message);
        break;
      case 'denied':
        console.warn(message);
        break;
      default:
        console.log(message);
    }
  }

  private formatTimestamp(date: Date): string {
    return date.toISOString();
  }

  private formatOutcome(outcome: AuditEvent['outcome']): string {
    switch (outcome) {
      case 'success':
        return '✓';
      case 'failure':
        return '✗';
      case 'denied':
        return '⊘';
      default:
        return '?';
    }
  }

  private formatActor(actor: AuditEvent['actor']): string {
    if (actor.email) {
      return `${actor.type}:${actor.email}`;
    }
    return `${actor.type}:${actor.id}`;
  }
}
