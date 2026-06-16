import { ChevronLeft, ChevronRight } from 'lucide-react';
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
}

// The expand pill follows the pointer vertically along the edge, clamped so
// it never bleeds past the strip's ends.
const PILL_EDGE_MARGIN = 22;

const trackPillY = (strip: HTMLElement, clientY: number) => {
  const rect = strip.getBoundingClientRect();
  const y = Math.min(rect.height - PILL_EDGE_MARGIN, Math.max(PILL_EDGE_MARGIN, clientY - rect.top));
  strip.style.setProperty('--pill-y', `${y}px`);
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
  const expandButtonRef = useRef<HTMLButtonElement | null>(null);
  const stripRef = useRef<HTMLButtonElement | null>(null);
  const pillRef = useRef<HTMLSpanElement | null>(null);
  const enableSizeTransitions = useRef<() => void>(() => {});

  const spawnPill = (clientY: number) => {
    const strip = stripRef.current;
    const pill = pillRef.current;
    if (!strip || !pill) return;
    trackPillY(strip, clientY);
    pill.style.transitionProperty = 'opacity, translate';
    requestAnimationFrame(() => {
      pill.style.transitionProperty = '';
    });
  };

  const [booted, setBooted] = useState(false);
  const bootedRef = useRef(false);
  const bootScheduled = useRef(false);
  const boot = () => {
    if (bootScheduled.current) return;
    bootScheduled.current = true;
    requestAnimationFrame(() => {
      bootedRef.current = true;
      setBooted(true);
      enableSizeTransitions.current();
    });
  };

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const group = elementRef.current?.parentElement;
    if (!group) return;
    const panels = Array.from(group.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement && child.hasAttribute('data-panel'),
    );
    const separators = Array.from(group.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement && child.hasAttribute('data-separator'),
    );

    const enable = () => {
      if (!bootedRef.current) return;
      panels.forEach(
        panel =>
          (panel.style.transition =
            'flex-grow 300ms var(--ease-out-custom, ease), flex-basis 300ms var(--ease-out-custom, ease)'),
      );
    };
    const disable = () => panels.forEach(panel => (panel.style.transition = 'none'));

    enable();
    enableSizeTransitions.current = enable;
    separators.forEach(separator => separator.addEventListener('pointerdown', disable));
    window.addEventListener('pointerup', enable);
    window.addEventListener('pointercancel', enable);
    return () => {
      enableSizeTransitions.current = () => {};
      separators.forEach(separator => separator.removeEventListener('pointerdown', disable));
      window.removeEventListener('pointerup', enable);
      window.removeEventListener('pointercancel', enable);
      panels.forEach(panel => (panel.style.transition = ''));
    };
  }, []);

  useEffect(() => {
    if (!collapsed) return;
    const panelElement = elementRef.current;
    const separator = direction === 'left' ? panelElement?.nextElementSibling : panelElement?.previousElementSibling;
    if (!(separator instanceof HTMLElement) || !separator.hasAttribute('data-separator')) return;

    const setEdgeHovered = (hovered: boolean) => {
      const expandButton = expandButtonRef.current;
      const pill = pillRef.current;
      if (expandButton) expandButton.dataset.edgeHovered = hovered ? 'true' : 'false';
      if (pill) pill.dataset.edgeHovered = hovered ? 'true' : 'false';
    };
    const show = (event: PointerEvent) => {
      setEdgeHovered(true);
      spawnPill(event.clientY);
    };
    const hide = () => setEdgeHovered(false);
    const follow = (event: PointerEvent) => {
      if (stripRef.current) trackPillY(stripRef.current, event.clientY);
    };
    separator.addEventListener('pointerenter', show);
    separator.addEventListener('pointerleave', hide);
    separator.addEventListener('pointermove', follow);
    return () => {
      separator.removeEventListener('pointerenter', show);
      separator.removeEventListener('pointerleave', hide);
      separator.removeEventListener('pointermove', follow);
      setEdgeHovered(false);
    };
  }, [collapsed, direction]);

  const expand = () => {
    enableSizeTransitions.current();
    if (!panelRef.current) return;
    panelRef.current.expand();
  };

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
      onResize={(size, previousSize, panel) => {
        onResize?.(size, previousSize, panel);
        if (typeof collapsedSize !== 'number') return;
        setCollapsed(size.inPixels <= collapsedSize);
        boot();
      }}
    >
      <div
        inert={collapsed}
        data-state={collapsed ? 'collapsed' : 'open'}
        data-direction={direction}
        style={{
          minWidth: 'var(--panel-min-w)',
          opacity: collapsed ? 0 : undefined,
          translate: collapsed ? (direction === 'left' ? '-100% 0' : '100% 0') : undefined,
        }}
        className={cn(
          'absolute inset-y-0 w-full overflow-hidden',
          'transition-[opacity,translate] duration-300 ease-out-custom motion-reduce:transition-none',
          'data-[direction=left]:left-0 data-[direction=right]:right-0',
          'data-[state=collapsed]:z-10',
          !booted && 'transition-none',
        )}
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
            onPointerEnter={event => spawnPill(event.clientY)}
            onPointerMove={event => trackPillY(event.currentTarget, event.clientY)}
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
