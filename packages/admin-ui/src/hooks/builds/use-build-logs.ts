import { useState, useEffect } from 'react';
import { useWebSocket } from '../use-websocket';
import type { BuildLogEvent, BuildStatusEvent } from '@/lib/websocket-client';

export function useBuildLogs(buildId: string | undefined) {
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const { subscribe } = useWebSocket();

  useEffect(() => {
    if (!buildId) return;

    const unsubscribe = subscribe(`build:${buildId}`, event => {
      if (event.type === 'build:log') {
        const payload = event.payload as BuildLogEvent['payload'];
        setLogs(prev => [...prev, `[${payload.timestamp}] ${payload.line}`]);
      } else if (event.type === 'build:status') {
        const payload = event.payload as BuildStatusEvent['payload'];
        setStatus(payload.status);
      }
    });

    return unsubscribe;
  }, [buildId, subscribe]);

  const clearLogs = () => setLogs([]);

  return { logs, status, clearLogs };
}
