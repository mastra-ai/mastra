import { useParams } from 'react-router';
import { useEffect, useRef, useCallback, useState } from 'react';
import { useLogs } from '@/hooks/observability/use-logs';
import { Loader2, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LogsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useLogs(projectId!);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [hasInitiallyScrolled, setHasInitiallyScrolled] = useState(false);
  const prevScrollHeightRef = useRef(0);

  // Flatten all pages and reverse to get chronological order (oldest first)
  // API returns newest first (DESC), we reverse for display
  const logs = data?.pages.flatMap(page => [...page.data].reverse()).reverse() ?? [];

  // Scroll to bottom on initial load
  useEffect(() => {
    if (logs.length > 0 && !hasInitiallyScrolled && bottomRef.current) {
      setHasInitiallyScrolled(true);
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'auto' });
      }, 0);
    }
  }, [logs.length, hasInitiallyScrolled]);

  // Maintain scroll position when older logs are prepended
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !hasInitiallyScrolled) return;

    if (prevScrollHeightRef.current > 0) {
      const newScrollHeight = container.scrollHeight;
      const scrollDiff = newScrollHeight - prevScrollHeightRef.current;
      if (scrollDiff > 0 && container.scrollTop < 200) {
        container.scrollTop = scrollDiff;
      }
    }
    prevScrollHeightRef.current = container.scrollHeight;
  }, [logs.length, hasInitiallyScrolled]);

  // Intersection observer for loading more when scrolling UP
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage && hasInitiallyScrolled) {
        prevScrollHeightRef.current = scrollContainerRef.current?.scrollHeight ?? 0;
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage, hasInitiallyScrolled],
  );

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      root: scrollContainerRef.current,
      rootMargin: '100px',
      threshold: 0,
    });

    if (topSentinelRef.current) {
      observer.observe(topSentinelRef.current);
    }

    return () => observer.disconnect();
  }, [handleObserver]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToTop = () => {
    topSentinelRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent1" />
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-neutral9">Logs</h1>
        {data?.pages[0] && (
          <span className="text-sm text-neutral6">
            {logs.length} of {data.pages[0].total} logs
          </span>
        )}
      </div>

      <div className="bg-surface2 rounded-lg border border-border overflow-hidden relative">
        <div
          ref={scrollContainerRef}
          className="p-4 font-mono text-sm bg-black max-h-[600px] overflow-auto"
        >
          {logs.length > 0 ? (
            <>
              {/* Top sentinel for loading more */}
              <div ref={topSentinelRef} className="h-1" />

              {/* Loading indicator at top */}
              {isFetchingNextPage && (
                <div className="py-2 flex justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-neutral6" />
                </div>
              )}

              {/* Has more indicator */}
              {hasNextPage && !isFetchingNextPage && (
                <div className="py-2 flex justify-center">
                  <span className="text-neutral6 text-xs flex items-center gap-1">
                    <ArrowUp className="h-3 w-3" />
                    Scroll up for older logs
                  </span>
                </div>
              )}

              {!hasNextPage && logs.length > 0 && (
                <div className="py-2 flex justify-center">
                  <span className="text-neutral6 text-xs">Beginning of logs</span>
                </div>
              )}

              {/* Log entries */}
              {logs.map((log, index) => (
                <div key={`${log.id}-${index}`} className="py-1 flex">
                  <span className="text-neutral3 w-48 flex-shrink-0">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                  <span
                    className={`w-16 flex-shrink-0 ${
                      log.level === 'error'
                        ? 'text-red-500'
                        : log.level === 'warn'
                          ? 'text-yellow-500'
                          : log.level === 'info'
                            ? 'text-blue-500'
                            : 'text-neutral6'
                    }`}
                  >
                    {log.level.toUpperCase()}
                  </span>
                  <span className="text-neutral9 whitespace-pre-wrap">{log.message}</span>
                </div>
              ))}

              {/* Bottom anchor */}
              <div ref={bottomRef} />
            </>
          ) : (
            <div className="text-neutral6 py-8 text-center">No logs yet</div>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="absolute bottom-4 right-4 flex flex-col gap-2">
          {hasNextPage && (
            <Button variant="outline" size="sm" onClick={scrollToTop} className="bg-surface2">
              <ArrowUp className="h-4 w-4 mr-1" />
              Older
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={scrollToBottom} className="bg-surface2">
            <ArrowDown className="h-4 w-4 mr-1" />
            Latest
          </Button>
        </div>
      </div>
    </div>
  );
}
