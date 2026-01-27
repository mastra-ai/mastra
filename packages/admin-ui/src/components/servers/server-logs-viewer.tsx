import { useEffect, useRef, useState, useCallback } from 'react';
import { Download, Pause, Play, ArrowDown, ArrowUp, Terminal, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { LogLine } from '@/hooks/servers/use-server-logs-ws';

export type { LogLine };

interface ServerLogsViewerProps {
  logs: LogLine[];
  isConnected?: boolean;
  isLoading?: boolean;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => Promise<void>;
  className?: string;
}

export function ServerLogsViewer({
  logs,
  isConnected = false,
  isLoading = false,
  isLoadingMore = false,
  hasMore = false,
  onLoadMore,
  className,
}: ServerLogsViewerProps) {
  const [autoScroll, setAutoScroll] = useState(true);
  const [paused, setPaused] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const hasInitiallyScrolledRef = useRef(false);
  const prevScrollHeightRef = useRef(0);
  const isLoadingMoreRef = useRef(false);

  // Track loading state for scroll position maintenance
  useEffect(() => {
    isLoadingMoreRef.current = isLoadingMore;
  }, [isLoadingMore]);

  // Reset scroll state when logs are cleared (e.g., serverId change)
  useEffect(() => {
    if (logs.length === 0) {
      hasInitiallyScrolledRef.current = false;
      prevScrollHeightRef.current = 0;
    }
  }, [logs.length]);

  // Initial scroll to bottom when logs first load
  useEffect(() => {
    if (logs.length > 0 && !hasInitiallyScrolledRef.current && bottomRef.current) {
      hasInitiallyScrolledRef.current = true;
      // Use setTimeout to ensure DOM has rendered
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'auto' });
      }, 0);
    }
  }, [logs.length]);

  // Scroll to bottom when new logs arrive via WebSocket (if autoScroll is enabled)
  // Only after initial scroll has happened
  useEffect(() => {
    if (hasInitiallyScrolledRef.current && autoScroll && !paused && !isLoadingMoreRef.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs.length, autoScroll, paused]);

  // Maintain scroll position when older logs are prepended
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !hasInitiallyScrolledRef.current) return;

    // If we were loading more and scroll height changed, adjust position
    if (prevScrollHeightRef.current > 0) {
      const newScrollHeight = container.scrollHeight;
      const scrollDiff = newScrollHeight - prevScrollHeightRef.current;

      // Only adjust if we were near the top (loading older logs)
      if (container.scrollTop < 200 && scrollDiff > 0) {
        container.scrollTop = scrollDiff;
      }
    }

    prevScrollHeightRef.current = container.scrollHeight;
  }, [logs]);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;

    // Check if near bottom for auto-scroll
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setAutoScroll(isNearBottom);

    // Check if near top to load more
    if (scrollTop < 50 && hasMore && !isLoadingMore && onLoadMore) {
      // Save scroll height before loading more
      prevScrollHeightRef.current = container.scrollHeight;
      onLoadMore();
    }
  }, [hasMore, isLoadingMore, onLoadMore]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setAutoScroll(true);
  };

  const scrollToTop = () => {
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
    setAutoScroll(false);
  };

  const handleDownload = () => {
    const content = logs.map(log => `[${log.timestamp}] [${log.stream}] ${log.line}`).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'server-logs.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={cn('flex flex-col rounded-lg border border-border bg-surface1 relative', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface2">
        <div className="flex items-center gap-3">
          <Terminal className="h-4 w-4 text-neutral6" />
          <span className="text-sm font-medium">Server Logs</span>
          <Badge variant={isConnected ? 'success' : 'secondary'}>{isConnected ? 'Live' : 'Disconnected'}</Badge>
          <span className="text-xs text-neutral6">{logs.length} lines</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setPaused(!paused)}>
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {paused ? 'Resume' : 'Pause'}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDownload} disabled={logs.length === 0}>
            <Download className="h-4 w-4 mr-1" />
            Download
          </Button>
        </div>
      </div>

      {/* Log content */}
      <div
        ref={scrollContainerRef}
        className="h-[400px] overflow-y-auto"
        onScroll={handleScroll}
      >
        <pre className="p-4 font-mono text-xs leading-relaxed">
          {/* Top anchor for scroll to top */}
          <div ref={topRef} />

          {/* Loading indicator at top */}
          {isLoadingMore && (
            <div className="flex items-center justify-center py-2 text-neutral6">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span>Loading older logs...</span>
            </div>
          )}

          {/* Has more indicator */}
          {hasMore && !isLoadingMore && (
            <div className="flex items-center justify-center py-2 text-neutral6">
              <ArrowUp className="h-3 w-3 mr-1" />
              <span className="text-xs">Scroll up for older logs</span>
            </div>
          )}

          {/* Initial loading state */}
          {isLoading && logs.length === 0 && (
            <div className="flex items-center justify-center py-8 text-neutral6">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span>Loading logs...</span>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && logs.length === 0 && (
            <span className="text-neutral6">Waiting for logs...</span>
          )}

          {/* Log entries */}
          {logs.map(log => (
            <div key={log.id} className="hover:bg-surface3 flex">
              <span className="text-neutral3 w-28 flex-shrink-0 select-none">
                {format(new Date(log.timestamp), 'HH:mm:ss.SSS')}
              </span>
              <span className={cn('w-12 flex-shrink-0', log.stream === 'stderr' ? 'text-red-400' : 'text-neutral6')}>
                {log.stream}
              </span>
              <span className={cn(log.stream === 'stderr' ? 'text-red-400' : 'text-neutral9')}>{log.line}</span>
            </div>
          ))}

          {/* Bottom anchor */}
          <div ref={bottomRef} />
        </pre>
      </div>

      {/* Navigation buttons */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        {hasMore && (
          <Button variant="outline" size="sm" onClick={scrollToTop}>
            <ArrowUp className="h-4 w-4 mr-1" />
            Top
          </Button>
        )}
        {!autoScroll && (
          <Button variant="outline" size="sm" onClick={scrollToBottom}>
            <ArrowDown className="h-4 w-4 mr-1" />
            Latest
          </Button>
        )}
      </div>
    </div>
  );
}
