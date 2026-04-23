import { IconButton, StatusBadge, cn } from '@mastra/playground-ui';
import { Globe, Maximize2, Minimize2, X } from 'lucide-react';
import { useCallback } from 'react';
import { useBrowserSession } from '../../context/browser-session-context';
import type { StreamStatus } from '../../hooks/use-browser-stream';
import { BrowserToolCallHistory } from './browser-tool-call-history';
import { BrowserViewFrame } from './browser-view-frame';

/**
 * Get StatusBadge configuration based on stream status
 */
function getStatusBadgeConfig(status: StreamStatus): {
  variant: 'success' | 'warning' | 'error' | 'neutral';
  pulse: boolean;
  label: string;
} {
  switch (status) {
    case 'idle':
      return { variant: 'neutral', pulse: false, label: 'Idle' };
    case 'connecting':
      return { variant: 'warning', pulse: true, label: 'Connecting' };
    case 'connected':
      return { variant: 'warning', pulse: true, label: 'Connected' };
    case 'browser_starting':
      return { variant: 'warning', pulse: true, label: 'Starting' };
    case 'streaming':
      return { variant: 'success', pulse: false, label: 'Live' };
    case 'browser_closed':
      return { variant: 'neutral', pulse: false, label: 'Closed' };
    case 'disconnected':
      return { variant: 'error', pulse: true, label: 'Disconnected' };
    case 'error':
      return { variant: 'error', pulse: false, label: 'Error' };
    default:
      return { variant: 'neutral', pulse: false, label: 'Unknown' };
  }
}

/**
 * Browser content for the sidebar tab.
 * Shows the screencast, URL bar, and tool call history in a vertical scrolling layout.
 */
export function BrowserSidebarTab() {
  const { status, currentUrl, closeBrowser, setViewMode } = useBrowserSession();

  const handleClose = useCallback(async () => {
    await closeBrowser();
  }, [closeBrowser]);

  const handleCenterView = useCallback(() => {
    setViewMode('modal');
  }, [setViewMode]);

  const handleMinimize = useCallback(() => {
    setViewMode('collapsed');
  }, [setViewMode]);

  const handleFirstFrame = useCallback(() => {
    // No-op: isClosing is now managed by context
  }, []);

  const statusConfig = getStatusBadgeConfig(status);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* URL bar header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border1 shrink-0">
        <Globe className="h-4 w-4 text-neutral4 shrink-0" />
        <div className="flex-1 min-w-0 px-2 py-1 bg-surface2 rounded border border-border1">
          <span className={cn('text-xs truncate block', currentUrl ? 'text-neutral5' : 'text-neutral3 italic')}>
            {currentUrl || 'No URL'}
          </span>
        </div>
        <StatusBadge variant={statusConfig.variant} size="sm" withDot pulse={statusConfig.pulse}>
          {statusConfig.label}
        </StatusBadge>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Screencast */}
        <div className="p-3">
          <div className="relative">
            <BrowserViewFrame className="w-full" onFirstFrame={handleFirstFrame} />
            {/* Control buttons overlay */}
            <div className="absolute top-2 right-2 flex gap-1">
              <IconButton
                variant="light"
                size="sm"
                tooltip="Center view"
                onClick={handleCenterView}
                className="bg-surface1/80 backdrop-blur-sm"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton
                variant="light"
                size="sm"
                tooltip="Minimize to chat"
                onClick={handleMinimize}
                className="bg-surface1/80 backdrop-blur-sm"
              >
                <Minimize2 className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton
                variant="light"
                size="sm"
                tooltip="Close browser"
                onClick={handleClose}
                className="bg-surface1/80 backdrop-blur-sm"
              >
                <X className="h-3.5 w-3.5" />
              </IconButton>
            </div>
          </div>
        </div>

        {/* Browser actions history */}
        <div className="px-3 pb-3">
          <BrowserToolCallHistory />
        </div>
      </div>
    </div>
  );
}
