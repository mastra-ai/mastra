import { useLayoutEffect, useRef } from 'react';
import type { ComponentProps } from 'react';
import type { CollapsibleBoxState } from './use-collapsible-box';
import { cn } from '@/lib/utils';

export interface CollapsibleBoxProps extends ComponentProps<'div'> {
  state: CollapsibleBoxState;
}

/**
 * Clips its content to `state.collapsedHeight` and fades the bottom when it overflows.
 * The overflow is measured on the rendered content, so it tracks resizes and late content.
 */
export function CollapsibleBox({ state, children, className, style, ...props }: CollapsibleBoxProps) {
  const { collapsedHeight, isExpanded, isClipped, setClipped } = state;
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = contentRef.current;
    if (!element) return;

    const measure = () => setClipped(element.scrollHeight > collapsedHeight);
    measure();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [collapsedHeight, setClipped]);

  const showClipHint = !isExpanded && isClipped;

  return (
    <div
      data-slot="collapsible-box"
      // The hint masks the content itself, so it reads correctly on any background.
      {...(showClipHint ? { 'data-clipped': '' } : {})}
      className={cn(
        'relative min-w-0',
        !isExpanded && 'overflow-hidden',
        showClipHint && 'mask-b-from-60% mask-b-to-100%',
        className,
      )}
      style={isExpanded ? style : { ...style, maxHeight: collapsedHeight }}
      {...props}
    >
      <div ref={contentRef}>{children}</div>
    </div>
  );
}
