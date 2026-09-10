import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { PanelProps } from 'react-resizable-panels';
import { Panel, usePanelRef } from 'react-resizable-panels';
import { PanelEdgeIcon } from './panel-edge-icon';
import { panelIconButtonClass } from './panel-icon-button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Icon } from '@/ds/icons';
import { cn } from '@/lib/utils';

export interface CollapsiblePanelProps extends PanelProps {
  direction: 'left' | 'right';
  /**
   * Controlled collapsed state. The panel collapses/expands to match, and
   * `onCollapsedChange` reports changes coming from the panel itself (the
   * expand button, a persisted layout, dragging past the collapsed size).
   */
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
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
  collapsed,
  onCollapsedChange,
  ...props
}: CollapsiblePanelProps) => {
  // Physical state of the panel, as reported by onResize. It lags behind the
  // `collapsed` prop while the panel animates and drives what is rendered.
  const [isCollapsed, setIsCollapsed] = useState(false);
  // Width the panel had right before we collapsed it. The library's `expand()`
  // relies on its own "most recent size", which is unreliable when the panel
  // mounts already collapsed from a persisted layout (it opens at `minSize`).
  const sizeBeforeCollapseRef = useRef<number | null>(null);
  const internalPanelRef = usePanelRef();
  const panelRef = externalPanelRef ?? internalPanelRef;

  // Apply the controlled value. `isCollapsed` tells us whether the panel
  // already matches, which also covers changes we reported ourselves.
  useEffect(() => {
    if (collapsed === isCollapsed) return;
    const panel = panelRef.current;
    if (!panel) return;
    if (collapsed) {
      sizeBeforeCollapseRef.current = panel.getSize().inPixels;
      panel.collapse();
      return;
    }
    const target = sizeBeforeCollapseRef.current ?? defaultSize;
    if (target === undefined) {
      panel.expand();
      return;
    }
    panel.resize(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to the controlled value only
  }, [collapsed]);

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
        const next = size.inPixels <= collapsedSize;
        setIsCollapsed(next);
        if (next !== collapsed) onCollapsedChange(next);
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
              onClick={() => onCollapsedChange(false)}
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
