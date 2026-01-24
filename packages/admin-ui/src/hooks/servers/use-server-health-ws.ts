import { useState, useEffect } from 'react';
import { useWebSocket } from '../use-websocket';
import type { ServerHealthEvent } from '@/lib/websocket-client';

export function useServerHealthWs(serverId: string | undefined) {
  const [health, setHealth] = useState<ServerHealthEvent['payload'] | null>(null);
  const { subscribe } = useWebSocket();

  useEffect(() => {
    if (!serverId) return;

    const unsubscribe = subscribe(`server:${serverId}`, event => {
      if (event.type === 'server:health') {
        setHealth(event.payload as ServerHealthEvent['payload']);
      }
    });

    return unsubscribe;
  }, [serverId, subscribe]);

  return health;
}
