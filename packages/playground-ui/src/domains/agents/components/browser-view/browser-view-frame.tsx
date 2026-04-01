import { useCallback, useEffect, useRef, useState } from 'react';
import { useBrowserSession } from '../../context/browser-session-context';
import type { StreamStatus } from '../../hooks/use-browser-stream';
import { useClickRipple } from '../../hooks/use-click-ripple';
import { useInputCoordination } from '../../hooks/use-input-coordination';
import { useKeyboardInteraction } from '../../hooks/use-keyboard-interaction';
import { useMouseInteraction } from '../../hooks/use-mouse-interaction';
import { AgentBusyOverlay } from './agent-busy-overlay';
import { ClickRippleOverlay } from './click-ripple-overlay';
import { Skeleton } from '@/ds/components/Skeleton';
import { cn } from '@/lib/utils';

interface BrowserViewFrameProps {
  agentId: string;
  threadId: string;
  className?: string;
  onStatusChange?: (status: StreamStatus) => void;
  onUrlChange?: (url: string | null) => void;
  onFirstFrame?: () => void;
}

/**
 * Browser view frame component that displays screencast stream.
 *
 * Consumes the shared WebSocket connection from BrowserSessionContext.
 * Uses useRef pattern for img.src updates to bypass React virtual DOM.
 */
export function BrowserViewFrame({
  agentId: _agentId,
  threadId: _threadId,
  className,
  onStatusChange,
  onUrlChange,
  onFirstFrame,
}: BrowserViewFrameProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasFrame, setHasFrame] = useState(false);
  const [isInteractive, setIsInteractive] = useState(false);
  const [isRelaunching, setIsRelaunching] = useState(false);

  // Get shared state from context (WebSocket is managed by provider)
  const { status, currentUrl, latestFrame, viewport, sendMessage } = useBrowserSession();

  // Update img.src when new frame arrives
  useEffect(() => {
    if (latestFrame && imgRef.current) {
      imgRef.current.src = `data:image/jpeg;base64,${latestFrame}`;
      if (!imgRef.current.dataset.loaded) {
        imgRef.current.dataset.loaded = '1';
        setHasFrame(true);
      }
    }
  }, [latestFrame]);

  const exitInteractive = useCallback(() => {
    setIsInteractive(false);
  }, []);

  const handleFrameClick = useCallback(() => {
    if (status === 'streaming') {
      setIsInteractive(true);
    }
  }, [status]);

  const handleRelaunch = useCallback(() => {
    if (isRelaunching) return;
    setIsRelaunching(true);
    sendMessage(JSON.stringify({ type: 'relaunch' }));
  }, [isRelaunching, sendMessage]);

  const { isAgentBusy, activeToolName } = useInputCoordination();

  useMouseInteraction({
    imgRef,
    viewport,
    sendMessage,
    enabled: status === 'streaming' && !isAgentBusy,
  });

  useKeyboardInteraction({
    sendMessage,
    enabled: isInteractive,
    onEscape: exitInteractive,
  });

  const { ripples, removeRipple } = useClickRipple({
    imgRef,
    viewport,
    enabled: status === 'streaming' && hasFrame && !isAgentBusy,
  });

  // Notify parent of status changes
  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  // Notify parent of URL changes
  useEffect(() => {
    onUrlChange?.(currentUrl);
  }, [currentUrl, onUrlChange]);

  // Notify parent when first frame arrives (reliable signal that browser is active)
  useEffect(() => {
    if (hasFrame) {
      onFirstFrame?.();
    }
  }, [hasFrame, onFirstFrame]);

  // Exit interactive mode on click-outside or window blur
  useEffect(() => {
    if (!isInteractive) return;

    function handleDocumentMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsInteractive(false);
      }
    }

    function handleWindowBlur() {
      setIsInteractive(false);
    }

    document.addEventListener('mousedown', handleDocumentMouseDown);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('mousedown', handleDocumentMouseDown);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [isInteractive]);

  // Reset interactive mode when status changes away from streaming
  useEffect(() => {
    if (status !== 'streaming') {
      setIsInteractive(false);
    }
  }, [status]);

  // Reset relaunching state when browser becomes active again
  useEffect(() => {
    if (status !== 'browser_closed') {
      setIsRelaunching(false);
    }
  }, [status]);

  const isLoading = (status === 'connecting' || status === 'browser_starting' || status === 'streaming') && !hasFrame;
  const isReconnecting = status === 'disconnected' && hasFrame;
  const isBrowserClosed = status === 'browser_closed' && hasFrame;
  const hasError = status === 'error';

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full aspect-video bg-surface2 rounded-md overflow-hidden',
        isInteractive && !isAgentBusy && 'ring-2 ring-accent1',
        isInteractive && isAgentBusy && 'ring-2 ring-amber-400',
        className,
      )}
    >
      {/* Image element - always rendered, hidden via opacity until first frame loads */}
      <img
        ref={imgRef}
        alt="Browser screencast"
        onClick={handleFrameClick}
        className={cn(
          'absolute inset-0 w-full h-full object-contain',
          hasFrame ? 'opacity-100' : 'opacity-0',
          status === 'streaming' && (isInteractive ? 'cursor-text' : 'cursor-pointer'),
        )}
      />

      {/* Click ripple feedback overlay */}
      <ClickRippleOverlay ripples={ripples} onAnimationEnd={removeRipple} />

      {/* Agent busy overlay - shown when agent is executing a browser tool */}
      {isAgentBusy && <AgentBusyOverlay toolName={activeToolName} />}

      {/* Loading skeleton - shown until first frame arrives */}
      {isLoading && <Skeleton className="absolute inset-0" />}

      {/* Reconnecting overlay - shown over last frame */}
      {isReconnecting && (
        <div className="absolute inset-0 bg-surface1/80 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-4 h-4 border-2 border-neutral4 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-neutral4">Reconnecting...</span>
          </div>
        </div>
      )}

      {/* Browser closed overlay - shown when browser window is closed */}
      {isBrowserClosed && (
        <div
          className={cn(
            'absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center transition-colors',
            !isRelaunching && 'cursor-pointer hover:bg-black/60',
          )}
          onClick={handleRelaunch}
          role="button"
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              handleRelaunch();
            }
          }}
        >
          <div className="flex flex-col items-center gap-3 px-6 py-4 text-center">
            {isRelaunching ? (
              <>
                <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-lg font-medium text-white">Relaunching...</span>
                  <span className="text-sm text-white/70">Starting the browser</span>
                </div>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center">
                  <svg
                    className="w-7 h-7 text-white/80"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-lg font-medium text-white">Browser Closed</span>
                  <span className="text-sm text-white/70">Click to restart the browser</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Error overlay */}
      {hasError && (
        <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 px-6 py-4 text-center">
            <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg
                className="w-7 h-7 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-lg font-medium text-white">Connection Error</span>
              <span className="text-sm text-white/70">Failed to connect to browser</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
