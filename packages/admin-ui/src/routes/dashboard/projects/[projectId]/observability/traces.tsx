import { useParams } from 'react-router';
import { useEffect, useRef, useCallback } from 'react';
import { useTraces } from '@/hooks/observability/use-traces';
import { Loader2 } from 'lucide-react';

export function TracesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useTraces(projectId!);
  const loadMoreRef = useRef<HTMLTableRowElement>(null);

  // Flatten all pages into a single array of traces
  const traces = data?.pages.flatMap(page => page.data) ?? [];

  // Intersection observer for infinite scroll
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage],
  );

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: '100px',
      threshold: 0,
    });

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [handleObserver]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent1" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-neutral9">Traces</h1>
        {data?.pages[0] && (
          <span className="text-sm text-neutral6">
            {traces.length} of {data.pages[0].total} traces
          </span>
        )}
      </div>

      <div className="bg-surface2 rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="px-4 py-3 text-left text-sm font-medium text-neutral6">Trace ID</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-neutral6">Name</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-neutral6">Duration</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-neutral6">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-neutral6">Time</th>
            </tr>
          </thead>
          <tbody>
            {traces.length > 0 ? (
              <>
                {traces.map((trace, index) => (
                  <tr
                    key={`${trace.traceId}-${index}`}
                    className="border-b border-border last:border-0 hover:bg-surface3 cursor-pointer"
                  >
                    <td className="px-4 py-3 text-sm font-mono text-neutral9">
                      {trace.traceId.slice(0, 8)}...
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral9">{trace.name}</td>
                    <td className="px-4 py-3 text-sm text-neutral6">{trace.durationMs ?? '-'}ms</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          trace.status === 'ok' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                        }`}
                      >
                        {trace.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-neutral6">
                      {new Date(trace.startTime).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {/* Load more trigger row */}
                <tr ref={loadMoreRef}>
                  <td colSpan={5} className="px-4 py-3 text-center">
                    {isFetchingNextPage && <Loader2 className="h-5 w-5 animate-spin text-neutral6 mx-auto" />}
                    {!hasNextPage && traces.length > 0 && (
                      <span className="text-neutral6 text-xs">End of traces</span>
                    )}
                  </td>
                </tr>
              </>
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral6">
                  No traces yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
