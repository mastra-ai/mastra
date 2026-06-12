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

const PANEL_SIZE_TRANSITION =
  'flex-grow 300ms var(--ease-out-custom, ease), flex-basis 300ms var(--ease-out-custom, ease)';

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
  style,
  minSize,
  ...props
}: CollapsiblePanelProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const panelRef = usePanelRef();
  const elementRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLButtonElement | null>(null);
  const pillRef = useRef<HTMLSpanElement | null>(null);
  const enableSizeTransitions = useRef<() => void>(() => {});

  // On pointer entry the pill must spawn under the cursor, not glide over
  // from its previous position: suppress the `top` trailing transition for
  // one frame while keeping the opacity fade-in.
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

  // A panel restored in its collapsed state must FIRST PAINT collapsed, not
  // load open and animate shut: every transition stays disarmed until one
  // frame after the library reports the initial size.
  const [booted, setBooted] = useState(false);
  const bootedRef = useRef(false);
  const bootScheduled = useRef(false);
  const boot = () => {
    if (bootScheduled.current) return;
    bootScheduled.current = true;
    requestAnimationFrame(() => {
      bootedRef.current = true;
      setBooted(true);
    });
  };

  // Animate panel sizes on collapse/expand so the neighboring layout reflows
  // smoothly instead of jumping. The library only sets flex styles on the
  // group's panel elements; a CSS transition on them is purely visual and
  // must be suspended while dragging to keep resizing direct.
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
      panels.forEach(panel => (panel.style.transition = PANEL_SIZE_TRANSITION));
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

  // Arm the size transitions once the initial layout has painted.
  useEffect(() => {
    if (booted) enableSizeTransitions.current();
  }, [booted]);

  // Hovering the adjacent resize handle should also reveal the expand pill.
  // The separator is a sibling element, out of reach of CSS group/hover.
  const [edgeHovered, setEdgeHovered] = useState(false);
  useEffect(() => {
    if (!collapsed) return;
    const panelElement = elementRef.current;
    const separator = direction === 'left' ? panelElement?.nextElementSibling : panelElement?.previousElementSibling;
    if (!(separator instanceof HTMLElement) || !separator.hasAttribute('data-separator')) return;

    const show = (event: PointerEvent) => {
      setEdgeHovered(true);
      spawnPill(event.clientY);
    };
    const hide = () => setEdgeHovered(false);
    // The pill follows the pointer along the separator too, so the affordance
    // stays under the cursor across the whole edge.
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
    // Re-assert the size transition right before the programmatic expand: a
    // just-finished drag may have left it suspended, which made the panel
    // snap open instantly instead of animating.
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
      // The library's nested div defaults to overflow auto, which would clip
      // the expand strip floating past the zero-width collapsed panel. While
      // expanded it clips the min-width content so the moving panel reveals it.
      style={
        {
          overflow: collapsed ? 'visible' : 'hidden',
          '--panel-min-w': numericMinSize ? `${numericMinSize}px` : undefined,
          ...style,
        } as CSSProperties
      }
      {...props}
      onResize={size => {
        if (typeof collapsedSize !== 'number') return;
        setCollapsed(size.inPixels <= collapsedSize);
        boot();
      }}
    >
      {/* The wrapper always tracks the panel width but never lays out
          narrower than the panel's minimum size: transient widths (drag,
          expand animation, collapsed at zero) clip the content instead of
          rewrapping it. Anchored to the panel's outer edge, it slides + fades
          out on collapse and slides back in on expand — opacity and translate
          are plain inline styles, natively animated by the static transition
          classes. */}
      <div
        inert={collapsed}
        data-state={collapsed ? 'collapsed' : 'open'}
        data-direction={direction}
        style={{
          opacity: collapsed ? 0 : undefined,
          translate: collapsed ? (direction === 'left' ? '-100% 0' : '100% 0') : undefined,
        }}
        className={cn(
          'absolute inset-y-0 w-full min-w-(--panel-min-w) overflow-hidden',
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
          {/* Always-visible hint that a panel can be opened here, placed like
              a header action inside the interface. Fades in via
              @starting-style when the panel reaches its collapsed state. */}
          <button
            type="button"
            aria-label="Expand panel"
            onClick={expand}
            className={cn(
              panelIconButtonClass,
              'absolute top-2 z-10',
              'transition-[color,background-color,opacity] duration-300 starting:opacity-0',
              direction === 'left' ? 'left-2' : 'right-2',
              edgeHovered && 'text-neutral6',
            )}
          >
            <Icon>
              <PanelEdgeIcon side={direction} />
            </Icon>
          </button>

          {/* Expand affordance for pointers: thin hover strip floating over the
              neighboring panel's edge — takes no layout space. The pill chevron
              follows the cursor along the strip. The edge-most 4px stay free
              for the separator's drag hit zone. Keyboard users get the button
              above instead. */}
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
              className={cn(
                'absolute top-(--pill-y) flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-neutral6 text-surface1 shadow-dialog',
                'pointer-events-none opacity-0 transition-[opacity,translate,top] duration-150 ease-out-custom motion-reduce:transition-none',
                direction === 'left' ? 'left-0.5 -translate-x-1' : 'right-0.5 translate-x-1',
                'group-hover/expand:pointer-events-auto group-hover/expand:translate-x-0 group-hover/expand:opacity-100',
                'group-active/expand:bg-neutral6/80',
                edgeHovered && 'pointer-events-auto translate-x-0 opacity-100',
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
