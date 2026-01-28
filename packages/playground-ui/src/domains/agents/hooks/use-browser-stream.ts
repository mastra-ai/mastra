import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Connection status for the browser screencast stream
 */
export type StreamStatus =
  | 'idle' // Not connected
  | 'connecting' // WebSocket connecting
  | 'connected' // WebSocket open, waiting for stream
  | 'browser_starting' // Browser launching
  | 'streaming' // Receiving frames
  | 'disconnected' // Connection lost
  | 'error'; // Error state

interface UseBrowserStreamOptions {
  agentId: string;
  enabled?: boolean;
  onFrame?: (data: string) => void;
  maxReconnectAttempts?: number;
}

interface UseBrowserStreamReturn {
  status: StreamStatus;
  error: string | null;
  currentUrl: string | null;
  connect: () => void;
  disconnect: () => void;
  isActive: boolean;
}

/**
 * WebSocket management hook for browser screencast streaming.
 *
 * Features:
 * - Auto-reconnect with exponential backoff
 * - Tab visibility change handling
 * - Frame callback bypasses React state for performance
 */
export function useBrowserStream(options: UseBrowserStreamOptions): UseBrowserStreamReturn {
  const { agentId, enabled = true, onFrame, maxReconnectAttempts = 5 } = options;

  const [status, setStatus] = useState<StreamStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);

  // Store WebSocket in ref to avoid creating new connections on render
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onFrameRef = useRef(onFrame);

  // Keep onFrame ref current without causing reconnections
  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    clearReconnectTimeout();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('idle');
    setError(null);
  }, [clearReconnectTimeout]);

  const connect = useCallback(() => {
    // Don't connect if already connecting or connected
    if (wsRef.current?.readyState === WebSocket.CONNECTING || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    // Clear any existing connection and timeout
    clearReconnectTimeout();
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setStatus('connecting');
    setError(null);

    // Construct WebSocket URL based on current protocol
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/browser/${agentId}/stream`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        setError(null);
        // Reset reconnect attempts on successful connection
        reconnectAttemptRef.current = 0;
      };

      ws.onmessage = event => {
        const data = event.data as string;

        // Check if message is JSON (status/error messages start with '{')
        if (data.startsWith('{')) {
          try {
            const parsed = JSON.parse(data) as {
              status?: string;
              error?: string;
              url?: string;
            };

            if (parsed.status) {
              // Map server status to StreamStatus
              switch (parsed.status) {
                case 'browser_starting':
                  setStatus('browser_starting');
                  break;
                case 'streaming':
                  setStatus('streaming');
                  break;
                case 'stopped':
                  setStatus('disconnected');
                  break;
                default:
                  // Keep current status for unknown statuses
                  break;
              }
            }

            if (parsed.error) {
              setError(parsed.error);
              setStatus('error');
            }

            if (parsed.url !== undefined) {
              setCurrentUrl(parsed.url);
            }
          } catch {
            // If JSON parsing fails, treat as frame data
            onFrameRef.current?.(data);
          }
        } else {
          // Plain text is base64 frame data
          onFrameRef.current?.(data);
          // Ensure we're in streaming status when receiving frames
          setStatus(prev => (prev !== 'streaming' ? 'streaming' : prev));
        }
      };

      ws.onerror = () => {
        // Error event doesn't provide useful info, wait for close
        setError('WebSocket error occurred');
      };

      ws.onclose = event => {
        wsRef.current = null;

        // Don't reconnect if intentionally closed or max attempts reached
        if (!event.wasClean && enabled && reconnectAttemptRef.current < maxReconnectAttempts) {
          setStatus('disconnected');

          // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 30000);
          reconnectAttemptRef.current += 1;

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else if (reconnectAttemptRef.current >= maxReconnectAttempts) {
          setStatus('error');
          setError('Maximum reconnection attempts reached');
        } else {
          setStatus('idle');
        }
      };
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Failed to create WebSocket');
    }
  }, [agentId, enabled, maxReconnectAttempts, clearReconnectTimeout]);

  // Handle tab visibility changes - reconnect when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled && status === 'disconnected') {
        // Reset reconnect attempts when user returns to tab
        reconnectAttemptRef.current = 0;
        connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, status, connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearReconnectTimeout();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [clearReconnectTimeout]);

  const isActive = status === 'connecting' || status === 'connected' || status === 'browser_starting' || status === 'streaming';

  return {
    status,
    error,
    currentUrl,
    connect,
    disconnect,
    isActive,
  };
}
