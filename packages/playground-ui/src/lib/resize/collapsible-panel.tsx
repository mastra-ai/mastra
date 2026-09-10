import type { CSSProperties, Ref } from 'react';
import { useImperativeHandle, useRef, useState } from 'react';
import type { PanelProps } from 'react-resizable-panels';
import { Panel, usePanelRef } from 'react-resizable-panels';
import { PanelEdgeIcon } from './panel-edge-icon';
import { panelIconButtonClass } from './panel-icon-button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Icon } from '@/ds/icons';
import { cn } from '@/lib/utils';

/** Programmatic control over a CollapsiblePanel (distinct from the library's panel handle). */
export interface CollapsiblePanelHandle {
  collapse: () => void;
  /** Reopens at the width the panel had when `collapse()` was called, else at `defaultSize`. */
  expand: () => void;
}

export interface CollapsiblePanelProps extends PanelProps {
  direction: 'left' | 'right';
  ref?: Ref<CollapsiblePanelHandle>;
}

export const CollapsiblePanel = ({
  collapsedSize,
  children,
  direction,
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
  const internalPanelRef = usePanelRef();
  const panelRef = externalPanelRef ?? internalPanelRef;

  const collapse = () => {
    const panel = panelRef.current;
    if (!panel) return;
    sizeBeforeCollapseRef.current = panel.getSize().inPixels;
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

  useImperativeHandle(ref, () => ({ collapse, expand }));

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
        setIsCollapsed(size.inPixels <= collapsedSize);
      }}
    >
      <div
        hidden={isCollapsed}
        style={{ minWidth: 'var(--panel-min-w)' }}
        className={cn('absolute inset-y-0 w-full overflow-hidden', direction === 'left' ? 'left-0' : 'right-0')}
      >
        {children}
      </div>

      {isCollapsed && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Expand panel"
              onClick={expand}
              className={cn(
                panelIconButtonClass,
                'absolute top-2 z-10',
                'transition-[color,background-color,opacity] duration-300 starting:opacity-0',
                direction === 'left' ? 'left-2' : 'right-2',
              )}
            >
              <Icon>
                <PanelEdgeIcon side={direction} />
              </Icon>
            </button>
          </TooltipTrigger>
          <TooltipContent side={direction === 'left' ? 'right' : 'left'}>Expand panel</TooltipContent>
        </Tooltip>
      )}
    </Panel>
  );
};
