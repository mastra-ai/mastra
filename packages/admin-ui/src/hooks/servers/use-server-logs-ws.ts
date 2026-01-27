import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from '../use-websocket';
import { useAdminClient } from '../use-admin-client';
import type { ServerLogEvent } from '@/lib/websocket-client';

const MAX_LOGS = 1000;
const PAGE_SIZE = 100;

export interface LogLine {
  id: string;
  line: string;
  timestamp: string;
  stream: 'stdout' | 'stderr';
}

interface UseServerLogsWsResult {
  logs: LogLine[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  clearLogs: () => void;
  isConnected: boolean;
}

export function useServerLogsWs(serverId: string | undefined): UseServerLogsWsResult {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const oldestCursorRef = useRef<string | null>(null);
  const hasInitializedRef = useRef(false);
  const { subscribe, isConnected } = useWebSocket();
  const adminClient = useAdminClient();
  const queryClient = useQueryClient();

  // Fetch initial logs via HTTP (newest logs first)
  const { data: initialData, isLoading } = useQuery({
    queryKey: ['server-logs', serverId, 'initial'],
    queryFn: async () => {
      if (!serverId) return null;
      const result = await adminClient.servers.getLogsPaginated(serverId, { limit: PAGE_SIZE });
      return result;
    },
    enabled: !!serverId,
    staleTime: Infinity, // Only fetch once per session
    refetchOnWindowFocus: false,
  });

  // Reset when serverId changes
  useEffect(() => {
    hasInitializedRef.current = false;
    setLogs([]);
    setHasMore(false);
    oldestCursorRef.current = null;
  }, [serverId]);

  // Handle initial data from query
  useEffect(() => {
    if (initialData && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      setLogs(initialData.entries);
      setHasMore(initialData.hasMore);
      oldestCursorRef.current = initialData.oldestCursor;
    }
  }, [initialData]);

  // Subscribe to WebSocket for new logs
  useEffect(() => {
    if (!serverId) return;

    const unsubscribe = subscribe(`server:${serverId}`, event => {
      if (event.type === 'server:log') {
        const payload = event.payload as ServerLogEvent['payload'];
        const newLog: LogLine = {
          id: payload.id || `ws_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          line: payload.line,
          timestamp: payload.timestamp,
          stream: payload.stream,
        };

        setLogs(prev => {
          const newLogs = [...prev, newLog];
          // Keep only the last MAX_LOGS entries to prevent memory issues
          return newLogs.slice(-MAX_LOGS);
        });
      }
    });

    return unsubscribe;
  }, [serverId, subscribe]);

  // Load more (older) logs when scrolling up
  const loadMore = useCallback(async () => {
    if (!serverId || !hasMore || isLoadingMore || !oldestCursorRef.current) return;

    setIsLoadingMore(true);
    try {
      const result = await adminClient.servers.getLogsPaginated(serverId, {
        limit: PAGE_SIZE,
        before: oldestCursorRef.current,
      });

      if (result.entries.length > 0) {
        setLogs(prev => {
          // Prepend older logs to the beginning
          const combined = [...result.entries, ...prev];
          // Keep only the last MAX_LOGS entries
          return combined.slice(-MAX_LOGS);
        });
        oldestCursorRef.current = result.oldestCursor;
      }
      setHasMore(result.hasMore);
    } finally {
      setIsLoadingMore(false);
    }
  }, [serverId, hasMore, isLoadingMore, adminClient]);

  const clearLogs = useCallback(() => {
    setLogs([]);
    setHasMore(false);
    oldestCursorRef.current = null;
    queryClient.invalidateQueries({ queryKey: ['server-logs', serverId] });
  }, [queryClient, serverId]);

  return {
    logs,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    clearLogs,
    isConnected,
  };
}
