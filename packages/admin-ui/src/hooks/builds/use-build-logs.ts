import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../use-websocket';
import type { BuildLogEvent, BuildStatusEvent } from '@/lib/websocket-client';

/**
 * Parse a logs string into an array of lines.
 * Logs may be stored without proper newlines, so we split on timestamp patterns.
 */
function parseLogsString(logs: string | undefined): string[] {
  if (!logs) return [];

  // First try splitting on newlines
  const byNewline = logs.split('\n').filter(line => line.trim() !== '');
  if (byNewline.length > 1) {
    return byNewline;
  }

  // If that doesn't work, split on timestamp patterns like [2026-01-24T17:28:26.450Z]
  // Use lookahead to keep the delimiter with the following content
  const byTimestamp = logs.split(/(?=\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/).filter(line => line.trim() !== '');
  return byTimestamp;
}

export function useBuildLogs(buildId: string | undefined, initialLogs?: string) {
  const [logs, setLogs] = useState<string[]>(() => parseLogsString(initialLogs));
  const [status, setStatus] = useState<string | null>(null);
  const { subscribe } = useWebSocket();
  const initializedRef = useRef(false);

  // Update logs when initialLogs changes (e.g., from API fetch)
  useEffect(() => {
    if (initialLogs && !initializedRef.current) {
      const parsed = parseLogsString(initialLogs);
      if (parsed.length > 0) {
        setLogs(parsed);
        initializedRef.current = true;
      }
    }
  }, [initialLogs]);

  // Subscribe to WebSocket for real-time updates
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

  const clearLogs = () => {
    setLogs([]);
    initializedRef.current = false;
  };

  return { logs, status, clearLogs };
}
