import { useQuery } from '@tanstack/react-query';
import type { AuditFilter, AuditListResponse } from '../types.js';

export interface UseAuditLogsOptions extends AuditFilter {
  enabled?: boolean;
}

/**
 * Hook for fetching audit logs with filtering and pagination
 *
 * @param options - Filter options and pagination parameters
 * @returns Query result with audit events, loading state, and error
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useAuditLogs({
 *   outcome: 'failure',
 *   limit: 50,
 *   offset: 0,
 * });
 * ```
 */
export function useAuditLogs(options: UseAuditLogsOptions = {}) {
  const { enabled = true, ...filter } = options;

  return useQuery<AuditListResponse>({
    queryKey: ['audit', 'logs', filter],
    queryFn: async () => {
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

      const response = await fetch(`/api/audit?${params.toString()}`, {
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
    },
    enabled,
    staleTime: 30000, // 30 seconds
    gcTime: 60000, // 1 minute
  });
}

/**
 * Hook for exporting audit logs
 *
 * @param format - Export format (json or csv)
 * @returns Mutation for triggering export download
 *
 * @example
 * ```tsx
 * const exportAuditLogs = useExportAuditLogs();
 *
 * <button onClick={() => exportAuditLogs({ format: 'csv', outcome: 'failure' })}>
 *   Export Failed Events
 * </button>
 * ```
 */
export function useExportAuditLogs() {
  return async (options: AuditFilter & { format: 'json' | 'csv' }) => {
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

    const response = await fetch(`/api/audit/export?${params.toString()}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Failed to export audit logs');
    }

    // Trigger download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString()}.${format}`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };
}
