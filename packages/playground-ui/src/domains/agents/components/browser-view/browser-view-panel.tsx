import { useState, useCallback } from 'react';
import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/ds/components/StatusBadge';
import { BrowserViewFrame } from './browser-view-frame';
import { BrowserViewHeader } from './browser-view-header';
import { BrowserToolCallHistory } from './browser-tool-call-history';
import { useBrowserSession } from '../../context/browser-session-context';
import type { StreamStatus } from '../../hooks/use-browser-stream';

type ViewState = 'expanded' | 'minimized' | 'tucked';

interface BrowserViewPanelProps {
  agentId: string;
}

/**
 * Browser view panel that assembles frame and header components.
 * Renders as an overlay positioned absolutely over the right portion of the layout.
 *
 * States:
 * - Hidden: translated off-screen (isActive=false)
 * - Expanded: full-height overlay on the right
 * - Minimized: mini browser window in top-right corner
 * - Tucked: small pill in top-right corner, click to restore
 *
 * IMPORTANT: Always mounted to preserve WebSocket connection.
 * BrowserViewFrame is always at the same tree position to avoid remounts.
 */
export function BrowserViewPanel({ agentId }: BrowserViewPanelProps) {
  const { isActive, status, currentUrl, show, hide, setStatus, setCurrentUrl } = useBrowserSession();
  const [isClosing, setIsClosing] = useState(false);
  const [viewState, setViewState] = useState<ViewState>('minimized');

  const handleStatusChange = useCallback(
    (newStatus: StreamStatus) => {
      setStatus(newStatus);
      console.log('[BrowserViewPanel] status changed:', newStatus);

      if (newStatus === 'streaming') {
        show();
        setIsClosing(false);
      }
    },
    [setStatus, show],
  );

  const handleUrlChange = useCallback(
    (url: string | null) => {
      setCurrentUrl(url);
    },
    [setCurrentUrl],
  );

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

  const handleFirstFrame = useCallback(() => {
    show();
    setIsClosing(false);
  }, [show]);

  const handleToggleCollapse = useCallback(() => {
    setViewState(prev => (prev === 'expanded' ? 'minimized' : 'expanded'));
  }, []);

  const handleTuck = useCallback(() => {
    setViewState('tucked');
  }, []);

  const handleUntuck = useCallback(() => {
    setViewState('minimized');
  }, []);

  const isTucked = viewState === 'tucked';
  const isMinimized = viewState === 'minimized';
  const isExpanded = viewState === 'expanded';
  const isLive = status === 'streaming';

  return (
    <>
      {/* Tucked pill — visible only when active + tucked */}
      {isActive && isTucked && (
        <button
          type="button"
          onClick={handleUntuck}
          className="absolute top-2 right-2 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface2 border border-border1 shadow-lg hover:bg-surface3 transition-colors"
        >
          <Globe className="h-3.5 w-3.5 text-neutral4" />
          <span className="text-xs font-medium text-neutral4">Browser</span>
          <StatusBadge variant={isLive ? 'success' : 'neutral'} size="sm" withDot pulse={isLive}>
            {isLive ? 'Live' : 'Idle'}
          </StatusBadge>
        </button>
      )}

      {/* Main overlay — always rendered at the same tree position to preserve WebSocket */}
      <div
        className={cn(
          'absolute z-10 shadow-xl transition-all duration-300 ease-in-out',
          isActive && !isTucked
            ? isMinimized
              ? 'top-2 right-2 w-[480px] h-80 rounded-lg'
              : 'inset-y-0 right-0 w-[40%]'
            : 'inset-y-0 right-0 w-[40%] translate-x-full',
        )}
      >
        <div className={cn('flex flex-col bg-surface2 overflow-hidden', isMinimized ? 'rounded-lg' : 'h-full')}>
          {!isTucked && (
            <BrowserViewHeader
              url={currentUrl}
              status={status}
              isCollapsed={isMinimized}
              onClose={handleClose}
              onToggleCollapse={handleToggleCollapse}
              onTuck={isMinimized ? handleTuck : undefined}
            />
          )}
          <div className={cn('shrink-0', isMinimized && 'flex-1 min-h-0 p-1')}>
            <BrowserViewFrame agentId={agentId} onStatusChange={handleStatusChange} onUrlChange={handleUrlChange} onFirstFrame={handleFirstFrame} />
          </div>
          {isExpanded && <BrowserToolCallHistory className="flex-1 min-h-0" />}
        </div>
      </div>
    </>
  );
}
