import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '../use-websocket';
import type { ServerLogEvent } from '@/lib/websocket-client';

const MAX_LOGS = 1000;

export function useServerLogsWs(serverId: string | undefined) {
  const [logs, setLogs] = useState<ServerLogEvent['payload'][]>([]);
  const { subscribe } = useWebSocket();

  useEffect(() => {
    if (!serverId) return;

    const unsubscribe = subscribe(`server:${serverId}`, event => {
      if (event.type === 'server:log') {
        setLogs(prev => {
          const newLogs = [...prev, event.payload as ServerLogEvent['payload']];
          // Keep only the last MAX_LOGS entries to prevent memory issues
          return newLogs.slice(-MAX_LOGS);
        });
      }
    });

    return unsubscribe;
  }, [serverId, subscribe]);

  const clearLogs = useCallback(() => setLogs([]), []);

  return { logs, clearLogs };
}
