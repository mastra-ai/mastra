import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { BrowserViewFrame } from './browser-view-frame';
import { BrowserViewHeader } from './browser-view-header';
import { BrowserToolCallHistory } from './browser-tool-call-history';
import type { StreamStatus } from '../../hooks/use-browser-stream';

interface BrowserViewPanelProps {
  agentId: string;
  className?: string;
}

/**
 * Browser view panel that assembles frame and header components.
 * Auto-shows when browser activity starts, hides only on explicit user close (X button).
 * Collapsible and sticky-positioned at the top-left of the chat scroll area.
 *
 * IMPORTANT: Renders a single BrowserViewFrame instance that never unmounts.
 * This keeps the WebSocket connection stable across visibility/collapse toggles
 * and prevents screencast stop/start churn on the server.
 */
export function BrowserViewPanel({ agentId, className }: BrowserViewPanelProps) {
  const [status, setStatus] = useState<StreamStatus>('idle');
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Handle status changes - manage visibility
  const handleStatusChange = useCallback((newStatus: StreamStatus) => {
    setStatus(newStatus);
    console.log('[BrowserViewPanel] status changed:', newStatus);

    // Show panel when streaming starts
    if (newStatus === 'streaming') {
      setIsVisible(true);
      setIsClosing(false);
    }
    // browser_closed just updates status display — panel stays visible
    // so the last frame remains as a snapshot. User dismisses via X button.
  }, []);

  // Handle URL changes
  const handleUrlChange = useCallback((url: string | null) => {
    setCurrentUrl(url);
  }, []);

  // Handle close button click — hides panel immediately, then closes browser in background
  const handleClose = useCallback(async () => {
    if (isClosing) return;
    setIsClosing(true);
    setIsVisible(false);

    try {
      const response = await fetch(`/api/agents/${agentId}/browser/close`, {
        method: 'POST',
      });

      if (!response.ok) {
        console.error('[BrowserViewPanel] Failed to close browser:', response.statusText);
      }
    } catch (error) {
      console.error('[BrowserViewPanel] Error closing browser:', error);
    } finally {
      setIsClosing(false);
    }
  }, [agentId, isClosing]);

  const handleToggleCollapse = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  // Single render path — BrowserViewFrame is always at the same tree position
  // so it never unmounts/remounts (stable WebSocket connection).
  // Outer wrapper switches between off-screen (hidden) and sticky (visible) via CSS.
  return (
    <div
      className={
        isVisible
          ? 'absolute top-4 left-0 z-10 max-w-3xl w-full px-4'
          : 'fixed -left-[9999px] -top-[9999px] w-0 h-0 overflow-hidden'
      }
      aria-hidden={!isVisible}
    >
      <div
        className={cn(
          isVisible && 'flex flex-col bg-surface2 rounded-lg border border-border1 overflow-hidden',
          className,
        )}
      >
        {isVisible && (
          <BrowserViewHeader
            url={currentUrl}
            status={status}
            isCollapsed={isCollapsed}
            onClose={handleClose}
            onToggleCollapse={handleToggleCollapse}
          />
        )}
        <div className={isVisible && !isCollapsed ? 'p-2' : 'hidden'}>
          <BrowserViewFrame agentId={agentId} onStatusChange={handleStatusChange} onUrlChange={handleUrlChange} />
        </div>
        {isVisible && !isCollapsed && <BrowserToolCallHistory />}
      </div>
    </div>
  );
}
