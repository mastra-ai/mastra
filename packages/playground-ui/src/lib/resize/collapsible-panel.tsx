import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CSSProperties, RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PanelProps } from 'react-resizable-panels';
import { Panel, usePanelRef } from 'react-resizable-panels';
import { PanelEdgeIcon } from './panel-edge-icon';
import { panelIconButtonClass } from './panel-icon-button';
import { useClampedElementCursor } from './use-clamped-element-cursor';
import { Icon } from '@/ds/icons';
import { cn } from '@/lib/utils';

export interface CollapsiblePanelProps extends PanelProps {
  direction: 'left' | 'right';
}

// The expand pill follows the pointer vertically along the edge, clamped so
// it never bleeds past the strip's ends.
const PILL_EDGE_MARGIN = 22;

type PanelElementRef = RefObject<HTMLDivElement | null>;

const useCollapsedEdgePill = ({
  collapsed,
  direction,
  elementRef,
}: {
  collapsed: boolean;
  direction: CollapsiblePanelProps['direction'];
  elementRef: PanelElementRef;
}) => {
  const expandButtonRef = useRef<HTMLButtonElement | null>(null);
  const pillRef = useRef<HTMLSpanElement | null>(null);
  const {
    beginTracking: beginPillTracking,
    elementRef: stripRef,
    endTracking: endPillTracking,
    updateTracking: updatePillTracking,
  } = useClampedElementCursor<HTMLButtonElement>({
    axis: 'y',
    margin: PILL_EDGE_MARGIN,
    variableName: '--pill-y',
  });

  const setEdgeHovered = useCallback((hovered: boolean) => {
    const expandButton = expandButtonRef.current;
    const pill = pillRef.current;
    if (expandButton) expandButton.dataset.edgeHovered = hovered ? 'true' : 'false';
    if (pill) pill.dataset.edgeHovered = hovered ? 'true' : 'false';
  }, []);

  const spawnPill = useCallback(
    (point: { clientX: number; clientY: number }) => {
      const pill = pillRef.current;
      if (!pill) return;
      beginPillTracking(point);
      pill.style.transitionProperty = 'opacity, translate';
      // Re-enable top transitions after the browser commits the pill's new
      // starting position; otherwise it travels in from its previous position.
      requestAnimationFrame(() => {
        pill.style.transitionProperty = '';
      });
    },
    [beginPillTracking],
  );

  const trackPillPosition = useCallback(
    (point: { clientX: number; clientY: number }) => {
      updatePillTracking(point);
    },
    [updatePillTracking],
  );

  useEffect(() => {
    if (!collapsed) return;
    const panelElement = elementRef.current;
    const separator = direction === 'left' ? panelElement?.nextElementSibling : panelElement?.previousElementSibling;
    if (!(separator instanceof HTMLElement) || !separator.hasAttribute('data-separator')) return;

    const show = (event: PointerEvent) => {
      setEdgeHovered(true);
      spawnPill(event);
    };
    const hide = () => {
      setEdgeHovered(false);
      endPillTracking();
    };
    const follow = (event: PointerEvent) => trackPillPosition(event);
    separator.addEventListener('pointerenter', show);
    separator.addEventListener('pointerleave', hide);
    separator.addEventListener('pointermove', follow);
    return () => {
      separator.removeEventListener('pointerenter', show);
      separator.removeEventListener('pointerleave', hide);
      separator.removeEventListener('pointermove', follow);
      setEdgeHovered(false);
      endPillTracking();
    };
  }, [collapsed, direction, elementRef, endPillTracking, setEdgeHovered, spawnPill, trackPillPosition]);

  return { endPillTracking, expandButtonRef, stripRef, pillRef, spawnPill, trackPillPosition };
};

export const CollapsiblePanel = ({
  collapsedSize,
  children,
  direction,
  className,
  onResize,
  style,
  minSize,
  ...props
}: CollapsiblePanelProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const panelRef = usePanelRef();
  const elementRef = useRef<HTMLDivElement | null>(null);
  const { endPillTracking, expandButtonRef, stripRef, pillRef, spawnPill, trackPillPosition } = useCollapsedEdgePill({
    collapsed,
    direction,
    elementRef,
  });

  const expand = () => panelRef.current?.expand();

  const numericMinSize = typeof minSize === 'number' ? minSize : null;

  return (
    <Panel
      panelRef={panelRef}
      elementRef={elementRef}
      collapsedSize={collapsedSize}
      minSize={minSize}
      className={cn('relative', className)}
      style={
        {
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
        <>
          <button
            ref={expandButtonRef}
            type="button"
            aria-label="Expand panel"
            onClick={expand}
            className={cn(
              panelIconButtonClass,
              'absolute top-2 z-10',
              'transition-[color,background-color,opacity] duration-300 starting:opacity-0',
              direction === 'left' ? 'left-2' : 'right-2',
              'data-[edge-hovered=true]:text-neutral6',
            )}
          >
            <Icon>
              <PanelEdgeIcon side={direction} />
            </Icon>
          </button>

          <button
            ref={stripRef}
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            onClick={expand}
            onPointerEnter={event => spawnPill(event)}
            onPointerLeave={endPillTracking}
            onPointerMove={event => trackPillPosition(event)}
            style={{ '--pill-y': '50%' } as CSSProperties}
            className={cn(
              'group/expand absolute inset-y-0 z-10 w-4 cursor-pointer focus-visible:outline-hidden',
              direction === 'left' ? 'left-1' : 'right-1',
            )}
          >
            <span
              ref={pillRef}
              style={{ top: 'var(--pill-y)' }}
              className={cn(
                'absolute flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-neutral6 text-surface1 shadow-dialog',
                'pointer-events-none opacity-0 transition-[opacity,translate,top] duration-150 ease-out-custom motion-reduce:transition-none',
                direction === 'left' ? 'left-0.5 -translate-x-1' : 'right-0.5 translate-x-1',
                'group-hover/expand:pointer-events-auto group-hover/expand:translate-x-0 group-hover/expand:opacity-100',
                'group-active/expand:bg-neutral6/80',
                'data-[edge-hovered=true]:pointer-events-auto data-[edge-hovered=true]:translate-x-0 data-[edge-hovered=true]:opacity-100',
              )}
            >
              <Icon>{direction === 'left' ? <ChevronRight /> : <ChevronLeft />}</Icon>
            </span>
          </button>
        </>
      )}
    </Panel>
  );
};
