import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { BrowserViewFrame } from './browser-view-frame';
import { BrowserViewHeader } from './browser-view-header';
import type { StreamStatus } from '../../hooks/use-browser-stream';

interface BrowserViewPanelProps {
  agentId: string;
  className?: string;
}

/**
 * Browser view panel that assembles frame and header components.
 * Handles visibility state with fade animation based on browser activity.
 */
export function BrowserViewPanel({ agentId, className }: BrowserViewPanelProps) {
  const [status, setStatus] = useState<StreamStatus>('idle');
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [delayedHide, setDelayedHide] = useState(true);

  // Handle status changes for visibility
  const handleStatusChange = useCallback((newStatus: StreamStatus) => {
    setStatus(newStatus);
  }, []);

  // Handle URL changes
  const handleUrlChange = useCallback((url: string | null) => {
    setCurrentUrl(url);
  }, []);

  // Control visibility based on status
  useEffect(() => {
    if (status === 'idle') {
      // Fade out first
      setIsVisible(false);
      // Then hide after animation completes
      const timer = setTimeout(() => setDelayedHide(true), 300);
      return () => clearTimeout(timer);
    } else {
      // Show immediately and fade in
      setDelayedHide(false);
      // Small delay to ensure DOM update before fade-in
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    }
  }, [status]);

  // Don't render if should be hidden
  if (delayedHide && status === 'idle') {
    return null;
  }

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-surface1 transition-opacity duration-300',
        isVisible ? 'opacity-100' : 'opacity-0',
        className,
      )}
    >
      <BrowserViewHeader url={currentUrl} status={status} />
      <div className="flex-1 p-2 overflow-hidden">
        <BrowserViewFrame agentId={agentId} onStatusChange={handleStatusChange} onUrlChange={handleUrlChange} />
      </div>
    </div>
  );
}
