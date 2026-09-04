import { Button } from '@/ds/components/Button';

export const EXAMPLES_PAGE_SIZE = 5;

/** Numbered pager for detail-panel example lists — page count derives from the theme's trace count. */
export function ExamplesPager({
  traceCount,
  offset,
  onOffsetChange,
}: {
  traceCount: number;
  offset: number;
  onOffsetChange: (offset: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(traceCount / EXAMPLES_PAGE_SIZE));
  const page = Math.floor(offset / EXAMPLES_PAGE_SIZE) + 1;
  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Example pages" className="mt-3 flex items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onOffsetChange((page - 2) * EXAMPLES_PAGE_SIZE)}
      >
        Previous
      </Button>
      <span className="text-neutral3 font-mono text-xs tabular-nums">
        Page {page} of {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onOffsetChange(page * EXAMPLES_PAGE_SIZE)}
      >
        Next
      </Button>
    </nav>
  );
}
