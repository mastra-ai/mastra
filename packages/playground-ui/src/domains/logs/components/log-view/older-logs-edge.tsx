import { Txt } from '@/ds/components/Txt';

export interface OlderLogsEdgeProps {
  isFetching?: boolean;
  onVisible: () => void;
}

export function OlderLogsEdge({ isFetching, onVisible }: OlderLogsEdgeProps) {
  const observe = (node: HTMLDivElement | null) => {
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) onVisible();
    });
    observer.observe(node);
    return () => observer.disconnect();
  };

  return (
    <div ref={observe} role="status" className="col-span-full flex min-h-6 items-center px-3">
      {isFetching && (
        <Txt as="span" variant="caption" tone="muted">
          Loading older logs
        </Txt>
      )}
    </div>
  );
}
