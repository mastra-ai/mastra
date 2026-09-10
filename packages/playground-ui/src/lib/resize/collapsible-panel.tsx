import type { CSSProperties } from 'react';
import { useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { PanelImperativeHandle, PanelProps } from 'react-resizable-panels';
import { Panel, usePanelRef } from 'react-resizable-panels';
import { PanelEdgeIcon } from './panel-edge-icon';
import { panelIconButtonClass } from './panel-icon-button';
import { Icon } from '@/ds/icons';
import { cn } from '@/lib/utils';

export interface CollapsiblePanelProps extends PanelProps {
  direction: 'left' | 'right';
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
  ...props
}: CollapsiblePanelProps) => {
  const [collapsed, setCollapsed] = useState(false);
  // Width the panel had right before `collapse()` was called. The library's
  // `expand()` relies on its own "most recent size", which is unreliable when
  // the panel mounts already collapsed from a persisted layout (it opens at
  // `minSize`), so we capture the exact width ourselves.
  const sizeBeforeCollapseRef = useRef<number | null>(null);
  const panelRef = usePanelRef();

  // Callers get the same handle, with `collapse()` recording the current width first.
  const handle = useMemo<PanelImperativeHandle>(
    () => ({
      collapse: () => {
        const panel = panelRef.current;
        if (!panel) return;
        if (!panel.isCollapsed()) sizeBeforeCollapseRef.current = panel.getSize().inPixels;
        panel.collapse();
      },
      expand: () => panelRef.current?.expand(),
      getSize: () => panelRef.current?.getSize() ?? { asPercentage: 0, inPixels: 0 },
      isCollapsed: () => panelRef.current?.isCollapsed() ?? false,
      resize: size => panelRef.current?.resize(size),
    }),
    [panelRef],
  );
  useImperativeHandle(externalPanelRef, () => handle, [handle]);

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
        setCollapsed(size.inPixels <= collapsedSize);
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
      )}
    </Panel>
  );
};
