import { Spinner } from '@/ds/components/Spinner';

const PREFETCH_MARGIN = '100% 0px';

function scrollParent(node: HTMLElement) {
  for (let element = node.parentElement; element; element = element.parentElement) {
    const { overflowY } = getComputedStyle(element);
    if (overflowY === 'auto' || overflowY === 'scroll') return element;
  }
  return null;
}

export interface LogViewPageEdgeProps {
  label: string;
  isFetching?: boolean;
  onVisible: () => void;
}

export function LogViewPageEdge({ label, isFetching, onVisible }: LogViewPageEdgeProps) {
  const observe = (node: HTMLDivElement | null) => {
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) onVisible();
      },
      { root: scrollParent(node), rootMargin: PREFETCH_MARGIN },
    );
    observer.observe(node);
    return () => observer.disconnect();
  };

  return (
    <div ref={observe} role="status" className="col-span-full flex min-h-6 items-center justify-center px-3">
      {isFetching && (
        <>
          <Spinner size="sm" aria-hidden className="text-muted-foreground" />
          <span className="sr-only">{label}</span>
        </>
      )}
    </div>
  );
}
