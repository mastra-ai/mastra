import { createContext, useContext, useSyncExternalStore } from 'react';
import type { StreamStatus } from '../hooks/use-browser-stream';
import type { BrowserFrameStore } from './browser-frame-store';

/** View modes for the browser UI */
export type BrowserViewMode = 'collapsed' | 'expanded' | 'modal';

export interface BrowserSessionContextValue {
  /** Whether the browser session has an active stream (for showing thumbnail) */
  hasSession: boolean;
  /** Current view mode for the browser UI */
  viewMode: BrowserViewMode;
  /** Whether the browser panel modal is expanded (viewMode === 'modal') */
  isPanelOpen: boolean;
  /** @deprecated Use hasSession instead */
  isActive: boolean;
  status: StreamStatus;
  currentUrl: string | null;
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
 * Consumer hook for reading browser session lifecycle state. Does NOT include
 * the high-frequency screencast frame data — for that, use `useBrowserFrame()`.
 * Must be used within a BrowserSessionProvider.
 */
export function useBrowserSession(): BrowserSessionContextValue {
  const ctx = useContext(BrowserSessionContext);
  if (!ctx) {
    throw new Error('useBrowserSession must be used within a BrowserSessionProvider');
  }
  return ctx;
}

/**
 * High-frequency screencast frame data. Isolated into an external store so
 * that frame updates (15-30 fps) only re-render the components that paint
 * frames (the viewer and the thumbnail). The provider component never re-
 * renders for frames because the store lives outside React state.
 */
export interface BrowserFrameContextValue {
  latestFrame: string | null;
}

export const BrowserFrameStoreContext = createContext<BrowserFrameStore | null>(null);

/**
 * Consumer hook for reading the latest screencast frame. Re-renders on every
 * new frame — only use in components that actually paint the frame.
 * Must be used within a BrowserSessionProvider.
 */
export function useBrowserFrame(): BrowserFrameContextValue {
  const store = useContext(BrowserFrameStoreContext);
  if (!store) {
    throw new Error('useBrowserFrame must be used within a BrowserSessionProvider');
  }
  const latestFrame = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return { latestFrame };
}
