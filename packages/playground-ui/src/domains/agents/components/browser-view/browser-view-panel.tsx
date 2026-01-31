import { useState, useCallback } from 'react';
import { BrowserViewFrame } from './browser-view-frame';
import { BrowserViewHeader } from './browser-view-header';
import { BrowserToolCallHistory } from './browser-tool-call-history';
import { useBrowserSession } from '../../context/browser-session-context';
import type { StreamStatus } from '../../hooks/use-browser-stream';

interface BrowserViewPanelProps {
  agentId: string;
}

/**
 * Browser view panel that assembles frame and header components.
 * Renders inside a collapsible layout panel (collapsedSize=0) in AgentLayout.
 * Auto-shows when browser activity starts, hides only on explicit user close (X button).
 *
 * IMPORTANT: Renders a single BrowserViewFrame instance that never unmounts.
 * The parent Panel uses collapsedSize=0 to hide content at zero width while
 * keeping this component mounted, preserving the WebSocket connection.
 */
export function BrowserViewPanel({ agentId }: BrowserViewPanelProps) {
  const { status, currentUrl, show, hide, setStatus, setCurrentUrl } = useBrowserSession();
  const [isClosing, setIsClosing] = useState(false);

  // Handle status changes - manage visibility
  const handleStatusChange = useCallback(
    (newStatus: StreamStatus) => {
      setStatus(newStatus);
      console.log('[BrowserViewPanel] status changed:', newStatus);

      // Show panel when streaming starts
      if (newStatus === 'streaming') {
        show();
        setIsClosing(false);
      }
      // browser_closed just updates status display — panel stays visible
      // so the last frame remains as a snapshot. User dismisses via X button.
    },
    [setStatus, show],
  );

  // Handle URL changes
  const handleUrlChange = useCallback(
    (url: string | null) => {
      setCurrentUrl(url);
    },
    [setCurrentUrl],
  );

  // Handle close button click — hides panel immediately, then closes browser in background
  const handleClose = useCallback(async () => {
    if (isClosing) return;
    setIsClosing(true);
    hide();

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
  }, [agentId, isClosing, hide]);

  // Single render path — BrowserViewFrame is always at the same tree position
  // so it never unmounts/remounts (stable WebSocket connection).
  // Parent Panel's collapsedSize=0 handles hiding at zero width.
  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <div className="flex flex-col bg-surface2 h-full overflow-hidden">
        <BrowserViewHeader
          url={currentUrl}
          status={status}
          onClose={handleClose}
        />
        <div className="flex-1 min-h-0 p-2">
          <BrowserViewFrame agentId={agentId} onStatusChange={handleStatusChange} onUrlChange={handleUrlChange} />
        </div>
        <BrowserToolCallHistory />
      </div>
    </div>
  );
}
