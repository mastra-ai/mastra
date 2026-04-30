import { IconButton, StatusBadge, cn } from '@mastra/playground-ui';
import { X, Minimize2, ExternalLink, Globe, PanelRight } from 'lucide-react';
import { useState, useCallback, useEffect, useRef } from 'react';
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
 * Full-screen modal browser view (center view mode).
 *
 * Shows the browser screencast in a large centered modal with:
 * - URL bar and status
 * - Browser actions below the screencast
 * - Controls to minimize, switch to sidebar, or close
 *
 * The panel is always mounted to preserve WebSocket connection.
 * Visibility is controlled via viewMode in browser session context.
 */
export function BrowserViewPanel({ hideSidebar = false }: { hideSidebar?: boolean }) {
  const { viewMode, status, currentUrl, hide, closeBrowser, setViewMode } = useBrowserSession();
  const [isVisible, setIsVisible] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const isPanelOpen = viewMode === 'modal';

  // Track visibility separately to allow animation
  useEffect(() => {
    if (isPanelOpen) {
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
  }, [isPanelOpen]);

  // Focus management: trap focus in dialog and restore on close
  useEffect(() => {
    if (isPanelOpen) {
      // Store the previously focused element
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      // Focus the dialog
      dialogRef.current?.focus();
    } else if (previousFocusRef.current) {
      // Restore focus when closing
      previousFocusRef.current.focus();
      previousFocusRef.current = null;
    }
  }, [isPanelOpen]);

  const handleClose = useCallback(async () => {
    await closeBrowser();
  }, [closeBrowser]);

  const handleMinimize = useCallback(() => {
    hide();
  }, [hide]);

  const handleOpenSidebar = useCallback(() => {
    setViewMode('sidebar');
  }, [setViewMode]);

  const handleOpenExternal = useCallback(() => {
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
  }, [currentUrl]);

  // Handle escape key to minimize
  useEffect(() => {
    if (!isPanelOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        hide();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isPanelOpen, hide]);

  // Handle backdrop click to minimize
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        hide();
      }
    },
    [hide],
  );

  const statusConfig = getStatusBadgeConfig(status);

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center p-8',
        'bg-black/60 backdrop-blur-sm transition-opacity duration-200',
        isPanelOpen && isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none',
      )}
      onClick={handleBackdropClick}
      aria-hidden={!isPanelOpen}
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
          isPanelOpen && isVisible ? 'scale-100' : 'scale-95',
        )}
        onClick={e => e.stopPropagation()}
      >
        {/* Header with URL bar and controls */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border1 shrink-0">
          <Globe className="h-4 w-4 text-neutral4 shrink-0" />
          <div className="flex-1 min-w-0 px-3 py-1.5 bg-surface3 rounded-md border border-border1">
            <span className={cn('text-sm truncate block', currentUrl ? 'text-neutral5' : 'text-neutral3 italic')}>
              {currentUrl || 'No URL'}
            </span>
          </div>
          <StatusBadge variant={statusConfig.variant} size="sm" withDot pulse={statusConfig.pulse}>
            {statusConfig.label}
          </StatusBadge>
          <div className="flex items-center gap-1 ml-2">
            {!hideSidebar && (
              <IconButton variant="ghost" size="sm" tooltip="Open in sidebar" onClick={handleOpenSidebar}>
                <PanelRight className="h-4 w-4" />
              </IconButton>
            )}
            <IconButton variant="ghost" size="sm" tooltip="Minimize to chat" onClick={handleMinimize}>
              <Minimize2 className="h-4 w-4" />
            </IconButton>
            {currentUrl && (
              <IconButton variant="ghost" size="sm" tooltip="Open in new tab" onClick={handleOpenExternal}>
                <ExternalLink className="h-4 w-4" />
              </IconButton>
            )}
            <IconButton variant="ghost" size="sm" tooltip="Close browser" onClick={handleClose}>
              <X className="h-4 w-4" />
            </IconButton>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          {/* Screencast */}
          <div className="p-4">
            <BrowserViewFrame className="w-full max-h-[60vh]" />
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
