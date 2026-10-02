import type { CSSProperties, Ref } from 'react';
import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { PanelProps } from 'react-resizable-panels';
import { Panel, usePanelRef } from 'react-resizable-panels';
import { PanelEdgeIcon } from './panel-edge-icon';
import { panelIconButtonClass } from './panel-icon-button';
import { Kbd } from '@/ds/components/Kbd';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Icon } from '@/ds/icons';
import { cn } from '@/lib/utils';

/** Programmatic control over a CollapsiblePanel (distinct from the library's panel handle). */
export interface CollapsiblePanelHandle {
  collapse: () => void;
  /** Reopens at the width the panel had when `collapse()` was called, else at `defaultSize`. */
  expand: () => void;
  /** Collapses when open, expands when collapsed (based on the panel's reported size). */
  toggle: () => void;
}

export interface CollapsiblePanelProps extends PanelProps {
  direction: 'left' | 'right';
  /** Key shown in the expand button tooltip when the caller binds a shortcut to `toggle()`. */
  expandShortcut?: string;
  /** Skip the floating "Expand panel" button when the caller provides its own expand control. */
  hideExpandButton?: boolean;
  ref?: Ref<CollapsiblePanelHandle>;
}

export const CollapsiblePanel = ({
  collapsedSize,
  children,
  direction,
  expandShortcut,
  hideExpandButton = false,
  className,
  onResize,
  style,
  minSize,
  defaultSize,
  panelRef: externalPanelRef,
  ref,
  ...props
}: CollapsiblePanelProps) => {
  // Physical state of the panel, as reported by onResize. It drives what is rendered.
  const [isCollapsed, setIsCollapsed] = useState(false);
  // Width the panel had right before we collapsed it. The library's `expand()`
  // relies on its own "most recent size", which is unreliable when the panel
  // mounts already collapsed from a persisted layout (it opens at `minSize`).
  const sizeBeforeCollapseRef = useRef<number | null>(null);
  // Width the panel had when the current pointer gesture started, so collapsing it
  // by dragging a separator to the edge reopens at that width rather than `minSize`.
  const settledSizeRef = useRef<number | null>(null);
  const isPointerDownRef = useRef(false);
  const internalPanelRef = usePanelRef();
  const panelRef = externalPanelRef ?? internalPanelRef;

  const collapsedThreshold = typeof collapsedSize === 'number' ? collapsedSize : 0;
  // Read the live size: `isCollapsed` only updates after the library's first `onResize`,
  // so a toggle fired right after mount would otherwise act on stale state.
  const isPanelCollapsed = (panel: NonNullable<typeof panelRef.current>) =>
    panel.getSize().inPixels <= collapsedThreshold;

  const collapse = () => {
    const panel = panelRef.current;
    if (!panel) return;
    // Never remember a collapsed width as the restore target.
    if (!isPanelCollapsed(panel)) sizeBeforeCollapseRef.current = panel.getSize().inPixels;
    panel.collapse();
  };

  const expand = () => {
    const panel = panelRef.current;
    if (!panel) return;
    const target = sizeBeforeCollapseRef.current ?? defaultSize;
    if (target === undefined) {
      panel.expand();
      return;
    }
    panel.resize(target);
  };

  const toggle = () => {
    const panel = panelRef.current;
    if (!panel) return;
    return isPanelCollapsed(panel) ? expand() : collapse();
  };

  useImperativeHandle(ref, () => ({ collapse, expand, toggle }));

  useEffect(() => {
    const onPointerDown = () => {
      isPointerDownRef.current = true;
      const panel = panelRef.current;
      if (panel && !isPanelCollapsed(panel)) settledSizeRef.current = panel.getSize().inPixels;
    };
    const onPointerUp = () => {
      isPointerDownRef.current = false;
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointerup', onPointerUp, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointerup', onPointerUp, true);
    };
  });

  const numericMinSize = typeof minSize === 'number' ? minSize : null;

  return (
    <Panel
      panelRef={panelRef}
      collapsedSize={collapsedSize}
      minSize={minSize}
      defaultSize={defaultSize}
      className={cn('relative', className)}
      style={
        {
          // The expand button must remain visible once the panel is at zero width.
          overflow: isCollapsed ? 'visible' : 'hidden',
          '--panel-min-w': numericMinSize ? `${numericMinSize}px` : undefined,
          ...style,
        } as CSSProperties
      }
      {...props}
      onResize={(size, id, previousSize) => {
        onResize?.(size, id, previousSize);
        if (typeof collapsedSize !== 'number') return;
        const nowCollapsed = size.inPixels <= collapsedSize;
        const wasCollapsed = previousSize !== undefined && previousSize.inPixels <= collapsedSize;
        if (!nowCollapsed && !isPointerDownRef.current) settledSizeRef.current = size.inPixels;
        // Collapsed by a drag or keyboard resize rather than `collapse()`: remember where it was.
        if (nowCollapsed && !wasCollapsed && previousSize !== undefined) {
          sizeBeforeCollapseRef.current = settledSizeRef.current ?? previousSize.inPixels;
        }
        setIsCollapsed(nowCollapsed);
      }}
    >
      <div
        hidden={isCollapsed}
        style={{ minWidth: 'var(--panel-min-w)' }}
        className={cn('absolute inset-y-0 w-full overflow-hidden', direction === 'left' ? 'left-0' : 'right-0')}
      >
        {children}
      </div>

      {isCollapsed && !hideExpandButton && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Expand panel"
              onClick={expand}
              className={cn(
                panelIconButtonClass,
                'absolute top-2 z-10',
                'transition-[color,opacity] duration-300 starting:opacity-0',
                direction === 'left' ? 'left-2' : 'right-2',
              )}
            >
              <Icon>
                <PanelEdgeIcon side={direction} />
              </Icon>
            </button>
          </TooltipTrigger>
          <TooltipContent side={direction === 'left' ? 'right' : 'left'}>
            <span className="inline-flex items-center gap-1.5">
              Expand panel
              {expandShortcut && <Kbd size="xs">{expandShortcut}</Kbd>}
            </span>
          </TooltipContent>
        </Tooltip>
      )}
    </Panel>
  );
};
