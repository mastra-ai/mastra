import { useQuery } from '@tanstack/react-query';
import { useAdminClient } from '../use-admin-client';
import { useAuth } from '../use-auth';

export function useServer(deploymentId: string) {
  const client = useAdminClient();
  const { session } = useAuth();

  return useQuery({
    queryKey: ['server', deploymentId],
    queryFn: () => client.servers.get(deploymentId),
    enabled: !!session?.access_token && !!deploymentId,
  });
}

export function useServerHealth(serverId: string) {
  const client = useAdminClient();
  const { session } = useAuth();

  return useQuery({
    queryKey: ['server-health', serverId],
    queryFn: () => client.servers.getHealth(serverId),
    enabled: !!session?.access_token && !!serverId,
    refetchInterval: 10000, // Poll every 10 seconds
  });
}

export function useServerLogs(serverId: string, params?: { limit?: number; since?: string }) {
  const client = useAdminClient();
  const { session } = useAuth();

  return useQuery({
    queryKey: ['server-logs', serverId, params],
    queryFn: () => client.servers.getLogs(serverId, params),
    enabled: !!session?.access_token && !!serverId,
  });
}

export function useServerMetrics(serverId: string) {
  const client = useAdminClient();
  const { session } = useAuth();

  return useQuery({
    queryKey: ['server-metrics', serverId],
    queryFn: () => client.servers.getMetrics(serverId),
    enabled: !!session?.access_token && !!serverId,
    refetchInterval: 30000, // Poll every 30 seconds
  });
}
