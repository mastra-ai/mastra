import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/ds/components/Skeleton';
import { useBrowserStream, type StreamStatus } from '../../hooks/use-browser-stream';

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
  const [hasFrame, setHasFrame] = useState(false);

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

  const { status, error, currentUrl, connect } = useBrowserStream({
    agentId,
    enabled: true,
    onFrame: handleFrame,
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

  const isLoading = (status === 'connecting' || status === 'browser_starting' || status === 'streaming') && !hasFrame;
  const isReconnecting = status === 'disconnected' && hasFrame;
  const hasError = status === 'error';

  return (
    <div className={cn('relative w-full aspect-video bg-surface2 rounded-md overflow-hidden', className)}>
      {/* Image element - always rendered, hidden via opacity until first frame loads */}
      <img
        ref={imgRef}
        alt="Browser screencast"
        className={cn('absolute inset-0 w-full h-full object-contain', hasFrame ? 'opacity-100' : 'opacity-0')}
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
