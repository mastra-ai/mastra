import type { AuditEvent, AuditFilter } from '../../../ee/interfaces/audit.js';
import { StorageDomain } from '../base.js';
import type { AuditEventRecord } from './types.js';

/**
 * Abstract base class for audit event storage
 *
 * Provides persistent storage for security audit events with querying capabilities.
 */
export abstract class AuditStorage extends StorageDomain {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'AUDIT',
    });
  }

  /**
   * Store a new audit event
   *
   * @param event - The audit event to store (without id and timestamp which are generated)
   * @returns The stored audit event record with generated id and timestamp
   */
  abstract store(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<AuditEventRecord>;

  /**
   * Query audit events with filtering and pagination
   *
   * @param filter - Filter criteria for querying events
   * @returns Array of matching audit events
   */
  abstract query(filter: AuditFilter): Promise<AuditEventRecord[]>;

  /**
   * Get a single audit event by ID
   *
   * @param id - The audit event ID
   * @returns The audit event or null if not found
   */
  abstract getById(id: string): Promise<AuditEventRecord | null>;

  /**
   * Get total count of audit events matching filter
   *
   * @param filter - Optional filter criteria (omit for total count)
   * @returns Total number of matching events
   */
  abstract count(filter?: AuditFilter): Promise<number>;
}
