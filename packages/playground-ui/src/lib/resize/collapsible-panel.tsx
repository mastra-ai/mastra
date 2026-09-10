import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { PanelProps } from 'react-resizable-panels';
import { Panel, usePanelRef } from 'react-resizable-panels';
import { PanelEdgeIcon } from './panel-edge-icon';
import { panelIconButtonClass } from './panel-icon-button';
import { Icon } from '@/ds/icons';
import { cn } from '@/lib/utils';

export interface CollapsiblePanelProps extends PanelProps {
  direction: 'left' | 'right';
  /**
   * Controlled collapsed state. When provided, the panel collapses/expands to
   * match, and `onCollapsedChange` reports changes coming from the panel itself
   * (the expand button, a persisted layout, dragging past the collapsed size).
   */
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
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
  collapsed: controlledCollapsed,
  onCollapsedChange,
  ...props
}: CollapsiblePanelProps) => {
  const [collapsed, setCollapsed] = useState(false);
  // Width the panel had right before we collapsed it. The library's `expand()`
  // relies on its own "most recent size", which is unreliable when the panel
  // mounts already collapsed from a persisted layout (it opens at `minSize`).
  const sizeBeforeCollapseRef = useRef<number | null>(null);
  const internalPanelRef = usePanelRef();
  const panelRef = externalPanelRef ?? internalPanelRef;

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

  const isControlled = controlledCollapsed !== undefined;

  // Apply the controlled value. `collapsed` (from onResize) tells us whether
  // the panel already matches, which also covers changes we reported ourselves.
  useEffect(() => {
    if (!isControlled || controlledCollapsed === collapsed) return;
    const panel = panelRef.current;
    if (!panel) return;
    if (controlledCollapsed) {
      sizeBeforeCollapseRef.current = panel.getSize().inPixels;
      panel.collapse();
    } else {
      expand();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to the controlled value only
  }, [controlledCollapsed]);

  const requestExpand = () => {
    if (isControlled) {
      onCollapsedChange?.(false);
      return;
    }
    expand();
  };

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
          overflow: collapsed ? 'visible' : 'hidden',
          '--panel-min-w': numericMinSize ? `${numericMinSize}px` : undefined,
          ...style,
        } as CSSProperties
      }
      {...props}
      onResize={(size, id, previousSize) => {
        onResize?.(size, id, previousSize);
        if (typeof collapsedSize !== 'number') return;
        const next = size.inPixels <= collapsedSize;
        setCollapsed(next);
        if (next !== (isControlled ? controlledCollapsed : collapsed)) onCollapsedChange?.(next);
      }}
    >
      <div
        hidden={collapsed}
        style={{ minWidth: 'var(--panel-min-w)' }}
        className={cn('absolute inset-y-0 w-full overflow-hidden', direction === 'left' ? 'left-0' : 'right-0')}
      >
        {children}
      </div>

      {collapsed && (
        <button
          type="button"
          aria-label="Expand panel"
          onClick={requestExpand}
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
      )}
    </Panel>
  );
};
