import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/ds/components/Skeleton';
import { useBrowserStream, type StreamStatus } from '../../hooks/use-browser-stream';
import { useMouseInteraction } from '../../hooks/use-mouse-interaction';
import { useKeyboardInteraction } from '../../hooks/use-keyboard-interaction';

interface BrowserViewFrameProps {
  agentId: string;
  className?: string;
  onStatusChange?: (status: StreamStatus) => void;
  onUrlChange?: (url: string | null) => void;
}

/**
 * Browser view frame component that displays screencast stream.
 * Uses useRef pattern for img.src updates to bypass React virtual DOM.
 */
export function BrowserViewFrame({ agentId, className, onStatusChange, onUrlChange }: BrowserViewFrameProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasFrame, setHasFrame] = useState(false);
  const [isInteractive, setIsInteractive] = useState(false);

  // Memoize onFrame to avoid recreation
  const handleFrame = useCallback((data: string) => {
    if (imgRef.current) {
      imgRef.current.src = `data:image/jpeg;base64,${data}`;
      if (!imgRef.current.dataset.loaded) {
        imgRef.current.dataset.loaded = '1';
        setHasFrame(true);
      }
    }
  }, []);

  const { status, error, currentUrl, viewport, sendMessage, connect } = useBrowserStream({
    agentId,
    enabled: true,
    onFrame: handleFrame,
  });

  const exitInteractive = useCallback(() => {
    setIsInteractive(false);
  }, []);

  const handleFrameClick = useCallback(() => {
    if (status === 'streaming') {
      setIsInteractive(true);
    }
  }, [status]);

  useMouseInteraction({
    imgRef,
    viewport,
    sendMessage,
    enabled: status === 'streaming',
  });

  useKeyboardInteraction({
    sendMessage,
    enabled: isInteractive,
    onEscape: exitInteractive,
  });

  // Notify parent of status changes
  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  // Notify parent of URL changes
  useEffect(() => {
    onUrlChange?.(currentUrl);
  }, [currentUrl, onUrlChange]);

  // Auto-connect when component mounts
  useEffect(() => {
    connect();
  }, [connect]);

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

  const isLoading = (status === 'connecting' || status === 'browser_starting' || status === 'streaming') && !hasFrame;
  const isReconnecting = status === 'disconnected' && hasFrame;
  const hasError = status === 'error';

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full aspect-video bg-surface2 rounded-md overflow-hidden',
        isInteractive && 'ring-2 ring-accent1',
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

      {/* Error overlay */}
      {hasError && (
        <div className="absolute inset-0 bg-surface1/90 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 px-4 text-center">
            <span className="text-sm text-accent2">Connection Error</span>
            {error && <span className="text-xs text-neutral4">{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
