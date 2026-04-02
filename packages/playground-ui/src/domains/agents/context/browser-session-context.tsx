import { createContext, useContext, useCallback, useState, useMemo, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { StreamStatus } from '../hooks/use-browser-stream';

/** View modes for the browser UI */
export type BrowserViewMode = 'collapsed' | 'expanded' | 'modal' | 'sidebar';

interface BrowserSessionContextValue {
  /** Whether the browser session has an active stream (for showing thumbnail) */
  hasSession: boolean;
  /** Current view mode for the browser UI */
  viewMode: BrowserViewMode;
  /** Whether the browser panel modal is expanded (viewMode === 'modal') */
  isPanelOpen: boolean;
  /** Whether browser is shown in sidebar (viewMode === 'sidebar') */
  isInSidebar: boolean;
  /** @deprecated Use hasSession instead */
  isActive: boolean;
  status: StreamStatus;
  currentUrl: string | null;
  latestFrame: string | null;
  /** Viewport dimensions from the browser */
  viewport: { width: number; height: number } | null;
  /** Whether a close operation is in progress */
  isClosing: boolean;
  /** Set the view mode */
  setViewMode: (mode: BrowserViewMode) => void;
  /** Open the browser panel modal (sets viewMode to 'modal') */
  show: () => void;
  /** Close overlays (sets viewMode to 'collapsed') */
  hide: () => void;
  /** End the browser session completely (local state only) */
  endSession: () => void;
  /** Close the browser via API and end session (waits for success before updating state) */
  closeBrowser: () => Promise<void>;
  /** Send a message to the browser (for input injection) */
  sendMessage: (data: string) => void;
  /** Connect to the browser stream */
  connect: () => void;
  /** Disconnect from the browser stream */
  disconnect: () => void;
}

const BrowserSessionContext = createContext<BrowserSessionContextValue | null>(null);

export interface BrowserSessionProviderProps {
  children: ReactNode;
  /** Agent ID for the browser session */
  agentId?: string;
  /** Thread ID for thread-scoped browser sessions */
  threadId?: string;
}

/**
 * Provider for browser session state and WebSocket connection.
 *
 * Manages a single WebSocket connection per provider instance.
 * All browser views (thumbnail, expanded, modal, sidebar) share this connection.
 */
export function BrowserSessionProvider({ children, agentId, threadId }: BrowserSessionProviderProps) {
  // UI state
  const [hasSession, setHasSession] = useState(false);
  const [viewMode, setViewModeState] = useState<BrowserViewMode>('collapsed');

  // Stream state
  const [status, setStatusState] = useState<StreamStatus>('idle');
  const [currentUrl, setCurrentUrlState] = useState<string | null>(null);
  const [latestFrame, setLatestFrameState] = useState<string | null>(null);
  const [viewport, setViewport] = useState<{ width: number; height: number } | null>(null);

  // WebSocket management
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxReconnectAttempts = 5;

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
    setStatusState('idle');
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
    if (!agentId || !threadId) return;

    // Clear any existing connection and timeout
    clearReconnectTimeout();
    if (wsRef.current) {
      intentionalCloseRef.current = true;
      wsRef.current.close();
      wsRef.current = null;
    }

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
          setStatusState(prev => {
            if (prev !== 'streaming') {
              setHasSession(true);
              return 'streaming';
            }
            return prev;
          });
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
  }, [agentId, threadId, clearReconnectTimeout]);

  // Auto-connect when agentId/threadId are available
  useEffect(() => {
    if (agentId && threadId) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [agentId, threadId, connect, disconnect]);

  // Handle tab visibility changes
  useEffect(() => {
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
  }, [status, agentId, threadId, connect]);

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

  // Close browser state
  const [isClosing, setIsClosing] = useState(false);

  const closeBrowser = useCallback(async () => {
    if (isClosing || !agentId) return;
    setIsClosing(true);

    try {
      const response = await fetch(`/api/agents/${agentId}/browser/close`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(`Failed to close browser: ${response.status}`);
      }
      // Only end session after successful API call
      endSession();
    } catch (error) {
      console.error('[BrowserSession] Error closing browser:', error);
      // Don't end session on failure - browser may still be running
    } finally {
      setIsClosing(false);
    }
  }, [agentId, isClosing, endSession]);

  const value = useMemo(
    () => ({
      hasSession,
      viewMode,
      isPanelOpen: viewMode === 'modal',
      isInSidebar: viewMode === 'sidebar',
      isActive: viewMode === 'modal', // backward compat
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

/**
 * Consumer hook for reading browser session state.
 * Must be used within a BrowserSessionProvider.
 */
export function useBrowserSession(): BrowserSessionContextValue {
  const ctx = useContext(BrowserSessionContext);
  if (!ctx) {
    throw new Error('useBrowserSession must be used within a BrowserSessionProvider');
  }
  return ctx;
}

export type { BrowserSessionContextValue };
