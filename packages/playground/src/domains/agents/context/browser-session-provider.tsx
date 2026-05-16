import { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useBrowserSessionProbe } from '../hooks/use-browser-session-probe';
import type { StreamStatus } from '../hooks/use-browser-stream';
import { useCloseBrowser } from '../hooks/use-close-browser';
import { BrowserSessionContext } from './browser-session-context';
import type { BrowserViewMode } from './browser-session-context';

export interface BrowserSessionProviderProps {
  children: ReactNode;
  /** Agent ID for the browser session */
  agentId?: string;
  /** Thread ID for thread-scoped browser sessions */
  threadId?: string;
  /**
   * Whether to open a WebSocket to the browser stream. Defaults to true for
   * backward compatibility, but callers should pass `false` for agents that
   * don't have a browser toolset configured to avoid an idle/retrying socket.
   */
  enabled?: boolean;
}

/**
 * Provider for browser session state and WebSocket connection.
 *
 * Manages a single WebSocket connection per provider instance.
 * All browser views (thumbnail, expanded, modal, sidebar) share this connection.
 */
export function BrowserSessionProvider({ children, agentId, threadId, enabled = true }: BrowserSessionProviderProps) {
  // Probe the server before opening a WebSocket. Avoids two failure modes:
  //   1. Server doesn't have `ws` / `@hono/node-ws` installed → WS upgrade
  //      would fail and trigger a reconnect storm.
  //   2. Agent has browser tools configured but no active session yet → WS
  //      would open and sit idle indefinitely.
  // Falls back to legacy "always connect" behavior on older servers (404).
  const { data: probe } = useBrowserSessionProbe({ agentId, threadId, enabled });
  const screencastAvailable = probe?.screencastAvailable ?? false;
  const serverHasSession = probe?.hasSession ?? false;

  // UI state
  const [hasSession, setHasSession] = useState(false);
  const [viewMode, setViewModeState] = useState<BrowserViewMode>('collapsed');

  // Open the WS when the server reports a live session OR the user has
  // explicitly opened the browser panel and expects to see frames.
  const userOpenedPanel = viewMode !== 'collapsed';
  const shouldConnect = enabled && screencastAvailable && (serverHasSession || userOpenedPanel);

  // Stream state
  const [status, setStatusState] = useState<StreamStatus>('idle');
  const [currentUrl, setCurrentUrlState] = useState<string | null>(null);
  const [latestFrame, setLatestFrameState] = useState<string | null>(null);
  const [viewport, setViewport] = useState<{ width: number; height: number } | null>(null);

  // WebSocket management
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentConnectionRef = useRef<{ agentId?: string; threadId?: string } | null>(null);
  const maxReconnectAttempts = 5;

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    clearReconnectTimeout();
    currentConnectionRef.current = null;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    // Clear all state to prevent stale data from showing on next thread
    setHasSession(false);
    setStatusState('idle');
    setCurrentUrlState(null);
    setLatestFrameState(null);
    setViewport(null);
  }, [clearReconnectTimeout]);

  const sendMessage = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  // Track intentional closes to avoid reconnecting after replacing a socket
  const intentionalCloseRef = useRef(false);

  const connect = useCallback(() => {
    if (!shouldConnect) return;
    if (!agentId || !threadId) return;

    // Skip if already connected/connecting to the same agent/thread
    if (
      currentConnectionRef.current?.agentId === agentId &&
      currentConnectionRef.current?.threadId === threadId &&
      wsRef.current?.readyState === WebSocket.OPEN
    ) {
      return;
    }

    // Clear any existing connection and timeout
    clearReconnectTimeout();
    if (wsRef.current) {
      intentionalCloseRef.current = true;
      wsRef.current.close();
      wsRef.current = null;
    }

    // Track what we're connecting to
    currentConnectionRef.current = { agentId, threadId };

    setStatusState('connecting');

    // Construct WebSocket URL based on current protocol
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/browser/${agentId}/stream?threadId=${encodeURIComponent(threadId)}`;

    try {
      const ws = new WebSocket(wsUrl);
      intentionalCloseRef.current = false;
      wsRef.current = ws;

      ws.onopen = () => {
        setStatusState('connected');
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
              viewport?: { width: number; height: number };
            };

            if (parsed.status) {
              switch (parsed.status) {
                case 'browser_starting':
                  setStatusState('browser_starting');
                  break;
                case 'streaming':
                  setStatusState('streaming');
                  setHasSession(true);
                  break;
                case 'browser_closed':
                  setStatusState('browser_closed');
                  setHasSession(false);
                  setViewModeState('collapsed');
                  break;
                case 'stopped':
                  setStatusState('disconnected');
                  break;
                case 'error':
                  setStatusState('error');
                  setHasSession(false);
                  break;
              }
            }

            if (parsed.url) {
              setCurrentUrlState(parsed.url);
            }

            if (parsed.viewport) {
              setViewport(parsed.viewport);
            }
          } catch {
            // If JSON parsing fails, treat as frame data
            setLatestFrameState(data);
          }
        } else {
          // Plain text is base64 frame data
          setLatestFrameState(data);
          // Ensure we're in streaming status when receiving frames
          setStatusState(prev => (prev !== 'streaming' ? 'streaming' : prev));
          setHasSession(true);
        }
      };

      ws.onerror = () => {
        // Error event doesn't provide useful info, wait for close
      };

      ws.onclose = event => {
        // Ignore close events from superseded sockets
        if (wsRef.current !== ws) return;

        wsRef.current = null;

        // Don't reconnect if intentionally closed or max attempts reached
        if (!intentionalCloseRef.current && !event.wasClean && reconnectAttemptRef.current < maxReconnectAttempts) {
          reconnectAttemptRef.current += 1;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current - 1), 10000);

          setStatusState('disconnected');
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else if (reconnectAttemptRef.current >= maxReconnectAttempts) {
          setStatusState('error');
        }
      };
    } catch {
      setStatusState('error');
    }
  }, [shouldConnect, agentId, threadId, clearReconnectTimeout]);

  // Auto-connect once the probe confirms the screencast is available and the
  // agent has an active session for this thread.
  useEffect(() => {
    if (shouldConnect && agentId && threadId) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [shouldConnect, agentId, threadId, connect, disconnect]);

  // Handle tab visibility changes
  useEffect(() => {
    if (!shouldConnect) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && status === 'disconnected' && agentId && threadId) {
        reconnectAttemptRef.current = 0;
        connect();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [shouldConnect, status, agentId, threadId, connect]);

  // UI actions
  const setViewMode = useCallback((mode: BrowserViewMode) => {
    setViewModeState(mode);
  }, []);

  const show = useCallback(() => {
    setViewModeState('modal');
  }, []);

  const hide = useCallback(() => {
    setViewModeState('collapsed');
  }, []);

  const endSession = useCallback(() => {
    setHasSession(false);
    setViewModeState('collapsed');
    setLatestFrameState(null);
  }, []);

  // Close browser via TanStack Query mutation
  const closeBrowserMutation = useCloseBrowser();

  const closeBrowser = useCallback(async () => {
    if (closeBrowserMutation.isPending || !agentId) return;

    try {
      await closeBrowserMutation.mutateAsync({ agentId, threadId });
      // Only end session after successful API call
      endSession();
    } catch {
      // Error already logged by mutation hook
      // Don't end session on failure - browser may still be running
    }
  }, [agentId, threadId, closeBrowserMutation, endSession]);

  const isClosing = closeBrowserMutation.isPending;

  const value = useMemo(
    () => ({
      hasSession,
      viewMode,
      isPanelOpen: viewMode === 'modal',
      isInSidebar: viewMode === 'sidebar',
      isActive: hasSession, // backward compat - reflects session activity, not view mode
      status,
      currentUrl,
      latestFrame,
      viewport,
      isClosing,
      setViewMode,
      show,
      hide,
      endSession,
      closeBrowser,
      sendMessage,
      connect,
      disconnect,
    }),
    [
      hasSession,
      viewMode,
      status,
      currentUrl,
      latestFrame,
      viewport,
      isClosing,
      setViewMode,
      show,
      hide,
      endSession,
      closeBrowser,
      sendMessage,
      connect,
      disconnect,
    ],
  );

  return <BrowserSessionContext.Provider value={value}>{children}</BrowserSessionContext.Provider>;
}
