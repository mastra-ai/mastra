import { useEffect, useCallback, useRef } from 'react';
import { WebSocketClient, WebSocketEvent } from '@/lib/websocket-client';
import { ADMIN_WS_URL } from '@/lib/constants';
import { useAuth } from './use-auth';
import { useWebSocketStore } from '@/stores/websocket-store';

let sharedClient: WebSocketClient | null = null;

export function useWebSocket() {
  const { session } = useAuth();
  const { isConnected, setConnected } = useWebSocketStore();
  const clientRef = useRef<WebSocketClient | null>(null);

  useEffect(() => {
    if (!session?.access_token) {
      return;
    }

    if (!sharedClient) {
      sharedClient = new WebSocketClient({
        url: ADMIN_WS_URL,
        getToken: async () => session.access_token ?? null,
      });
    }

    clientRef.current = sharedClient;

    sharedClient.connect().catch(err => {
      console.error('WebSocket connection failed:', err);
    });

    const unsubConnect = sharedClient.onConnect(() => setConnected(true));
    const unsubDisconnect = sharedClient.onDisconnect(() => setConnected(false));

    return () => {
      unsubConnect();
      unsubDisconnect();
    };
  }, [session?.access_token, setConnected]);

  const subscribe = useCallback((channel: string, handler: (event: WebSocketEvent) => void) => {
    if (!clientRef.current) return () => {};
    return clientRef.current.subscribe(channel, handler);
  }, []);

  return { isConnected, subscribe };
}
