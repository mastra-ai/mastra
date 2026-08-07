import { Button } from '@mastra/playground-ui/components/Button';
import { StatusBadge } from '@mastra/playground-ui/components/StatusBadge';
import { cn } from '@mastra/playground-ui/utils/cn';
import { X, Minimize2, ExternalLink, Globe } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useBrowserSession } from '../../context/browser-session-context';
import type { StreamStatus } from '../../hooks/use-browser-stream';
import { BrowserToolCallHistory } from './browser-tool-call-history';
import { BrowserViewFrame } from './browser-view-frame';
import { useRestoreFocus } from '@/hooks/use-restore-focus';

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
 * Full-screen modal browser view (center view mode).
 *
 * Shows the browser screencast in a large centered modal with:
 * - URL bar and status
 * - Browser actions below the screencast
 * - Controls to minimize or close
 *
 * The panel is always mounted to preserve WebSocket connection.
 * Visibility is controlled via viewMode in browser session context.
 */
export function BrowserViewPanel() {
  const { viewMode, status, currentUrl, hide, closeBrowser } = useBrowserSession();
  const isModal = viewMode === 'modal';
  const dialogRef = useRef<HTMLDivElement>(null);
  useRestoreFocus(isModal, dialogRef);

  const handleOpenExternal = () => {
    if (!currentUrl) return;

    // Validate URL to prevent javascript:/data: scheme attacks
    try {
      const url = new URL(currentUrl);
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        window.open(url.href, '_blank', 'noopener,noreferrer');
      }
    } catch {
      // Invalid URL, ignore
    }
  };

  // Handle escape key to minimize
  useEffect(() => {
    if (!isModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        hide();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isModal, hide]);

  // Handle backdrop click to minimize
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      hide();
    }
  };

  const statusConfig = getStatusBadgeConfig(status);

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-8',
        'bg-black/60 backdrop-blur-sm transition-opacity duration-200',
        isModal ? 'opacity-100' : 'opacity-0 pointer-events-none',
      )}
      onClick={handleBackdropClick}
      aria-hidden={!isModal}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Browser view"
        tabIndex={-1}
        className={cn(
          'flex flex-col w-full max-w-5xl max-h-full',
          'bg-surface2 rounded-xl border border-border1 shadow-2xl overflow-hidden',
          'transition-transform duration-200 outline-none',
          isModal ? 'scale-100' : 'scale-95',
        )}
        onClick={e => e.stopPropagation()}
      >
        {/* Header with URL bar and controls */}
        <div className="border-border1 flex shrink-0 items-center gap-3 border-b px-4 py-3">
          <Globe className="text-neutral4 h-4 w-4 shrink-0" />
          <div className="bg-surface3 border-border1 min-w-0 flex-1 rounded-md border px-3 py-1.5">
            <span className={cn('text-sm truncate block', currentUrl ? 'text-neutral5' : 'text-neutral3 italic')}>
              {currentUrl || 'No URL'}
            </span>
          </div>
          <StatusBadge variant={statusConfig.variant} size="sm" withDot pulse={statusConfig.pulse}>
            {statusConfig.label}
          </StatusBadge>
          <div className="ml-2 flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" tooltip="Minimize to chat" onClick={hide}>
              <Minimize2 className="h-4 w-4" />
            </Button>
            {currentUrl && (
              <Button variant="ghost" size="icon-sm" tooltip="Open in new tab" onClick={handleOpenExternal}>
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon-sm" tooltip="Close browser" onClick={closeBrowser}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          {/* Screencast */}
          <div className="p-4">
            <BrowserViewFrame className="max-h-[60vh] w-full" />
          </div>

          {/* Browser actions history */}
          <div className="px-4 pb-4">
            <BrowserToolCallHistory />
          </div>
        </div>
      </div>
    </div>
  );
}
