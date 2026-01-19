import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { AuditFilter, AuditListResponse } from '../types.js';
import { createAuditClient } from '../lib/audit-client';

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
  const client = useMastraClient();
  const { enabled = true, ...filter } = options;

  const auditClient = useMemo(() => {
    const baseUrl = (client as any).options?.baseUrl || '';
    return createAuditClient(baseUrl);
  }, [client]);

  return useQuery<AuditListResponse>({
    queryKey: ['audit', 'logs', filter],
    queryFn: () => auditClient.getAuditLogs(filter),
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
  const client = useMastraClient();

  const auditClient = useMemo(() => {
    const baseUrl = (client as any).options?.baseUrl || '';
    return createAuditClient(baseUrl);
  }, [client]);

  return async (options: AuditFilter & { format: 'json' | 'csv' }) => {
    const { format } = options;

    // Get blob from audit client
    const blob = await auditClient.exportAuditLogs(options);

    // Trigger download
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
