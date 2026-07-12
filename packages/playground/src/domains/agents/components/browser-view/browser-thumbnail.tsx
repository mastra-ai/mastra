import { Button } from '@mastra/playground-ui/components/Button';
import { StatusBadge } from '@mastra/playground-ui/components/StatusBadge';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Monitor, ChevronUp, ChevronDown, Maximize2, X } from 'lucide-react';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useBrowserFrame, useBrowserSession } from '../../context/browser-session-context';
import { useBrowserToolCalls } from '../../context/browser-tool-calls-context';
import { BrowserToolCallItem } from './browser-tool-call-item';
import { BrowserViewFrame } from './browser-view-frame';

interface BrowserThumbnailProps {
  agentName?: string;
}

/**
 * Browser preview component that appears in the chat area.
 *
 * Has two states:
 * - Collapsed: Small thumbnail bar (click to expand)
 * - Expanded: Larger view with screencast + actions, with a button to switch to modal
 */
export function BrowserThumbnail({ agentName = 'Agent' }: BrowserThumbnailProps) {
  const { hasSession, viewMode, status, currentUrl, setViewMode, closeBrowser } = useBrowserSession();
  const { latestFrame } = useBrowserFrame();
  const { toolCalls } = useBrowserToolCalls();
  const imgRef = useRef<HTMLImageElement>(null);
  const [hasFrame, setHasFrame] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  const isExpanded = viewMode === 'expanded';

  // Update thumbnail image when new frame arrives
  useEffect(() => {
    if (latestFrame) {
      const frameData = `data:image/jpeg;base64,${latestFrame}`;
      if (imgRef.current) {
        imgRef.current.src = frameData;
      }
      if (!hasFrame) {
        setHasFrame(true);
      }
    }
  }, [latestFrame, hasFrame]);

  // Reset frame state when session ends
  useEffect(() => {
    if (!hasSession) {
      setHasFrame(false);
      if (imgRef.current) {
        imgRef.current.src = '';
      }
    }
  }, [hasSession]);

  // Auto-scroll actions to bottom when new tool calls arrive
  useEffect(() => {
    if (isExpanded && actionsRef.current) {
      actionsRef.current.scrollTop = actionsRef.current.scrollHeight;
    }
  }, [toolCalls.length, isExpanded]);

  const handleToggleExpand = useCallback(() => {
    setViewMode(isExpanded ? 'collapsed' : 'expanded');
  }, [isExpanded, setViewMode]);

  const handleOpenModal = useCallback(() => {
    setViewMode('modal');
  }, [setViewMode]);

  const handleClose = useCallback(async () => {
    await closeBrowser();
  }, [closeBrowser]);

  const displayUrl = useMemo(() => {
    if (!currentUrl) return 'Browser';
    try {
      return new URL(currentUrl).hostname;
    } catch {
      return currentUrl;
    }
  }, [currentUrl]);

  // Don't render if no browser session or if showing in other modes
  if (!hasSession || viewMode === 'modal') {
    return null;
  }

  const isLive = status === 'streaming';

  return (
    <div
      className={cn(
        'overflow-hidden rounded-3xl border border-border1 bg-surface2 transition-all duration-200',
        'hover:border-border2',
      )}
    >
      {/* Collapsed header - always visible */}
      <button
        type="button"
        onClick={handleToggleExpand}
        className={cn(
          'group flex w-full items-center gap-3 px-4 py-3',
          'transition-colors hover:bg-surface3',
          'focus:ring-2 focus:ring-accent1 focus:outline-none focus:ring-inset',
        )}
      >
        {/* Thumbnail preview */}
        <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-md border border-border1 bg-surface3">
          {hasFrame ? (
            <img ref={imgRef} alt="Browser preview" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center">
              <Monitor className="size-5 text-neutral3" />
            </div>
          )}
          {/* Live indicator dot */}
          {isLive && <div className="bg-success absolute top-1 right-1 size-2 animate-pulse rounded-full" />}
        </div>

        {/* Info section */}
        <div className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-neutral6">{agentName}&apos;s browser</span>
            <StatusBadge variant={isLive ? 'success' : 'neutral'} size="sm" withDot pulse={isLive}>
              {isLive ? 'Live' : 'Idle'}
            </StatusBadge>
          </div>
          <p className="mt-0.5 truncate text-xs text-neutral4">{displayUrl}</p>
        </div>

        {/* Expand/collapse indicator */}
        <div className="shrink-0 text-neutral4 transition-colors group-hover:text-neutral5">
          {isExpanded ? <ChevronDown className="size-5" /> : <ChevronUp className="size-5" />}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-border1">
          {/* Interactive screencast */}
          <div className="p-3">
            <div className="relative">
              <BrowserViewFrame className="w-full" />
              {/* Control buttons overlay */}
              <div className="absolute top-2 right-2 flex gap-1">
                <Button
                  variant="default"
                  size="icon-sm"
                  tooltip="Center view"
                  onClick={handleOpenModal}
                  className="bg-surface1/80 backdrop-blur-sm"
                >
                  <Maximize2 className="size-3.5" />
                </Button>
                <Button
                  variant="default"
                  size="icon-sm"
                  tooltip="Close browser"
                  onClick={handleClose}
                  className="bg-surface1/80 backdrop-blur-sm"
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Browser actions (scrollable, max height) */}
          {toolCalls.length > 0 && (
            <div ref={actionsRef} className="max-h-40 overflow-y-auto border-t border-border1">
              <div className="px-3 py-2">
                <h4 className="mb-2 text-xs font-medium text-neutral4">Browser Actions</h4>
                <div className="space-y-1">
                  {toolCalls.slice(-5).map(entry => (
                    <BrowserToolCallItem key={entry.toolCallId} entry={entry} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
