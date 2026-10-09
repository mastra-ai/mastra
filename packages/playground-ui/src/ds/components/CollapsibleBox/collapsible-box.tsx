import { Maximize2 } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import type { ComponentProps } from 'react';
import type { CollapsibleBoxState } from './use-collapsible-box';
import { Button } from '@/ds/components/Button';
import { cn } from '@/lib/utils';

export interface CollapsibleBoxProps extends ComponentProps<'div'> {
  state: CollapsibleBoxState;
  /** When set, an expand button with this label sits at the bottom of the fade. */
  expandLabel?: string;
}

/**
 * Clips its content to `state.collapsedHeight` and fades the bottom when it overflows.
 * While clipped, clicking anywhere on the box expands it; the content is not interactive until then. The overflow is measured on the rendered
 * content, so it tracks resizes and late content.
 */
export function CollapsibleBox({ state, expandLabel, children, className, style, ...props }: CollapsibleBoxProps) {
  const { collapsedHeight, isExpanded, isClipped, setClipped, setExpanded } = state;
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
      {...(showClipHint ? { 'data-clipped': '' } : {})}
      className={cn('min-w-0', className, 'relative')}
      style={style}
      {...props}
    >
      {/* The mask sits on the clipped box so the fade covers its visible bottom, on any background. */}
      <div
        data-slot="collapsible-box-clip"
        className={cn(!isExpanded && 'overflow-hidden', showClipHint && 'mask-b-from-60% mask-b-to-100%')}
        style={isExpanded ? undefined : { maxHeight: collapsedHeight }}
      >
        <div ref={contentRef}>{children}</div>
      </div>
      {showClipHint && (
        <div
          data-slot="collapsible-box-fade"
          className="absolute inset-0 z-10 flex cursor-pointer items-end justify-center pb-2"
          onClick={() => setExpanded(true)}
        >
          {expandLabel && (
            <Button
              variant="ghost"
              size="sm"
              icon={<Maximize2 />}
              className="relative"
              onClick={event => {
                event.stopPropagation();
                setExpanded(true);
              }}
            >
              {expandLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
