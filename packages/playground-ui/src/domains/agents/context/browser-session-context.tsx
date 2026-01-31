import { createContext, useContext, useCallback, useState, useMemo, type ReactNode } from 'react';
import type { StreamStatus } from '../hooks/use-browser-stream';

interface BrowserSessionContextValue {
  isActive: boolean;
  status: StreamStatus;
  currentUrl: string | null;
  show: () => void;
  hide: () => void;
  setStatus: (status: StreamStatus) => void;
  setCurrentUrl: (url: string | null) => void;
}

const BrowserSessionContext = createContext<BrowserSessionContextValue | null>(null);

export function BrowserSessionProvider({ children }: { children: ReactNode }) {
  const [isActive, setIsActive] = useState(false);
  const [status, setStatusState] = useState<StreamStatus>('idle');
  const [currentUrl, setCurrentUrlState] = useState<string | null>(null);

  const show = useCallback(() => {
    setIsActive(true);
  }, []);

  const hide = useCallback(() => {
    setIsActive(false);
  }, []);

  const setStatus = useCallback((newStatus: StreamStatus) => {
    setStatusState(newStatus);
  }, []);

  const setCurrentUrl = useCallback((url: string | null) => {
    setCurrentUrlState(url);
  }, []);

  const value = useMemo(
    () => ({ isActive, status, currentUrl, show, hide, setStatus, setCurrentUrl }),
    [isActive, status, currentUrl, show, hide, setStatus, setCurrentUrl],
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
