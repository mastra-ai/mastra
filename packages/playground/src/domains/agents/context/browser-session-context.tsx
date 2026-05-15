import { createContext, useContext } from 'react';
import type { StreamStatus } from '../hooks/use-browser-stream';

// TODO: Consider splitting high-frequency frame data into a separate context or ref-based store
// to prevent consumers that only need low-frequency state (hasSession, viewMode) from rerendering
// on every screencast frame update. See: https://react.dev/reference/react/useSyncExternalStore

/** View modes for the browser UI */
export type BrowserViewMode = 'collapsed' | 'expanded' | 'modal' | 'sidebar';

export interface BrowserSessionContextValue {
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

export const BrowserSessionContext = createContext<BrowserSessionContextValue | null>(null);

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
