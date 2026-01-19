/**
 * Audit Client Utility
 *
 * Centralizes all audit log API calls to avoid direct fetch() usage in hooks.
 * This utility provides type-safe methods for audit operations that are not yet
 * available in the Mastra client SDK.
 *
 * NOTE: This is an interim solution. When the Mastra SDK adds audit methods,
 * migrate to using those instead.
 */

import type { AuditFilter, AuditListResponse } from '../types';

export interface AuditClientOptions {
  baseUrl: string;
}

export class AuditClient {
  private baseUrl: string;

  constructor(options: AuditClientOptions) {
    this.baseUrl = options.baseUrl;
  }

  /**
   * Fetches audit logs with optional filtering and pagination.
   */
  async getAuditLogs(filter: AuditFilter): Promise<AuditListResponse> {
    const params = new URLSearchParams();

    // Add filter parameters
    if (filter.actorId) params.append('actorId', filter.actorId);
    if (filter.actorType) params.append('actorType', filter.actorType);
    if (filter.action) params.append('action', filter.action);
    if (filter.resourceType) params.append('resourceType', filter.resourceType);
    if (filter.resourceId) params.append('resourceId', filter.resourceId);
    if (filter.outcome) params.append('outcome', filter.outcome);
    if (filter.startDate) params.append('startDate', filter.startDate.toISOString());
    if (filter.endDate) params.append('endDate', filter.endDate.toISOString());
    if (filter.offset !== undefined) params.append('offset', filter.offset.toString());
    if (filter.limit !== undefined) params.append('limit', filter.limit.toString());

    const response = await fetch(`${this.baseUrl}/api/audit?${params.toString()}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Failed to fetch audit logs');
    }

    const data = await response.json();

    // Convert timestamp strings to Date objects
    return {
      ...data,
      events: data.events.map((event: any) => ({
        ...event,
        timestamp: new Date(event.timestamp),
      })),
    };
  }

  /**
   * Exports audit logs in the specified format.
   * Returns a blob that can be downloaded.
   */
  async exportAuditLogs(options: AuditFilter & { format: 'json' | 'csv' }): Promise<Blob> {
    const { format, ...filter } = options;
    const params = new URLSearchParams({ format });

    // Add filter parameters
    if (filter.actorId) params.append('actorId', filter.actorId);
    if (filter.actorType) params.append('actorType', filter.actorType);
    if (filter.action) params.append('action', filter.action);
    if (filter.resourceType) params.append('resourceType', filter.resourceType);
    if (filter.resourceId) params.append('resourceId', filter.resourceId);
    if (filter.outcome) params.append('outcome', filter.outcome);
    if (filter.startDate) params.append('startDate', filter.startDate.toISOString());
    if (filter.endDate) params.append('endDate', filter.endDate.toISOString());

    const response = await fetch(`${this.baseUrl}/api/audit/export?${params.toString()}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Failed to export audit logs');
    }

    return response.blob();
  }
}

/**
 * Creates an audit client instance from base URL.
 */
export function createAuditClient(baseUrl: string): AuditClient {
  return new AuditClient({ baseUrl });
}
