import { useState, useEffect } from 'react';
import { ADMIN_WS_URL } from '@/lib/constants';
import { useAuth } from '../use-auth';

export function useBuildLogs(buildId: string | undefined) {
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const { session } = useAuth();

  useEffect(() => {
    if (!buildId || !session?.access_token) return;

    const url = new URL(ADMIN_WS_URL);
    url.searchParams.set('token', session.access_token);

    const ws = new WebSocket(url.toString());

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', payload: { channel: `build:${buildId}` } }));
    };

    ws.onmessage = event => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'build:log') {
          const payload = message.payload as { line: string; timestamp: string };
          setLogs(prev => [...prev, `[${payload.timestamp}] ${payload.line}`]);
        } else if (message.type === 'build:status') {
          const payload = message.payload as { status: string };
          setStatus(payload.status);
        }
      } catch {
        // Ignore parse errors
      }
    };

    return () => {
      ws.close();
    };
  }, [buildId, session?.access_token]);

  const clearLogs = () => setLogs([]);

  return { logs, status, clearLogs };
}
