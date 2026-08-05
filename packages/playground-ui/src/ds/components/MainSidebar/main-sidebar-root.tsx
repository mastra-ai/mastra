import { useCallback, useEffect, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useMainSidebar } from './main-sidebar-context';
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/ds/components/Drawer';
import { ResizeHandleIndicator } from '@/ds/primitives/resize-handle-indicator';
import { VisuallyHidden } from '@/ds/primitives/visually-hidden';
import { cn } from '@/lib/utils';

export type MainSidebarRootProps = {
  children: React.ReactNode;
  className?: string;
};

const KEYBOARD_STEP = 10;
const DRAG_THRESHOLD = 5;

export function MainSidebarRoot({ children, className }: MainSidebarRootProps) {
  const {
    state,
    width,
    minWidth,
    maxWidth,
    collapseBelow,
    collapsedWidth,
    isMobile,
    openMobile,
    setOpenMobile,
    setWidth,
    collapse,
    expand,
    commit,
    toggleSidebar,
    setGestureActive,
  } = useMainSidebar();
  const isCollapsed = state === 'collapsed';
  const isHidden = isCollapsed && collapsedWidth === 0;

  const draggedRef = useRef(false);
  // Tracks active drag so unmount mid-gesture can restore body styles.
  const dragCleanupRef = useRef<(() => void) | null>(null);

  // Restore global state if the component unmounts mid-drag.
  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
      dragCleanupRef.current = null;
    };
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();

      draggedRef.current = false;
      // Active styles on press, not after drag threshold.
      setGestureActive(true);

      const startX = event.clientX;

      const handle = event.currentTarget;
      const pointerId = event.pointerId;

      // Capture pointer: keeps :hover + col-resize cursor on handle for the
      // whole drag, even when cursor leaves the hotzone (collapsed snap-zone).
      try {
        handle.setPointerCapture(pointerId);
      } catch {
        // Pointer already gone.
      }

      // WYSIWYG resize: sidebar width = cursor X relative to sidebar's left edge.
      // Captured once — sidebar is `shrink-0`, left edge is stable during the gesture.
      const sidebarEl = handle.parentElement;
      const sidebarLeft = sidebarEl ? sidebarEl.getBoundingClientRect().left : 0;

      const prevCursor = document.body.style.cursor;
      const prevUserSelect = document.body.style.userSelect;

      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        const dx = ev.clientX - startX;
        if (!draggedRef.current) {
          if (Math.abs(dx) <= DRAG_THRESHOLD) return;
          draggedRef.current = true;
          document.body.style.cursor = 'col-resize';
          document.body.style.userSelect = 'none';
        }

        // Single rule, no started-state branch: cursor position alone defines state.
        const cursorWidth = ev.clientX - sidebarLeft;

        if (collapseBelow > 0 && cursorWidth < collapseBelow) {
          collapse();
          return;
        }
        expand();
        setWidth(cursorWidth);
      };
      const cleanup = (ev?: PointerEvent) => {
        if (ev && ev.pointerId !== pointerId) return;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', cleanup);
        window.removeEventListener('pointercancel', cleanup);
        document.body.style.cursor = prevCursor;
        document.body.style.userSelect = prevUserSelect;
        setGestureActive(false);
        commit();
        dragCleanupRef.current = null;
      };
      dragCleanupRef.current = () => cleanup();
      // Window-level listeners: pointer moves off the narrow handle fire reliably,
      // cursor leaving the window still gets `pointerup`.
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', cleanup);
      window.addEventListener('pointercancel', cleanup);
    },
    [collapseBelow, setWidth, expand, collapse, commit, setGestureActive],
  );

  const onClick = useCallback(() => {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    toggleSidebar();
  }, [toggleSidebar]);

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      switch (event.key) {
        case 'Enter':
        case ' ': {
          event.preventDefault();
          toggleSidebar();
          return;
        }
        case 'ArrowLeft': {
          event.preventDefault();
          if (isCollapsed) return;
          setWidth(width - KEYBOARD_STEP);
          commit();
          return;
        }
        case 'ArrowRight': {
          event.preventDefault();
          if (isCollapsed) {
            expand();
            commit();
            return;
          }
          setWidth(width + KEYBOARD_STEP);
          commit();
          return;
        }
        case 'Home': {
          event.preventDefault();
          expand();
          setWidth(minWidth);
          commit();
          return;
        }
        case 'End': {
          event.preventDefault();
          expand();
          setWidth(maxWidth);
          commit();
          return;
        }
      }
    },
    [isCollapsed, width, minWidth, maxWidth, setWidth, expand, commit, toggleSidebar],
  );

  // Mobile: render as an off-canvas drawer via Base UI Drawer.
  // Auto-close on link navigation (standard drawer UX). Don't gate on
  // `defaultPrevented` — client-side router links call `preventDefault()` for
  // SPA navigation, and we still want to close the drawer when they do.
  const closeOnAnchor = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const anchor = (event.target as HTMLElement).closest('a');
      if (!anchor || !anchor.hasAttribute('href')) return;
      // Skip non-primary clicks and modifier-clicks (open in new tab/window).
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      // Skip explicit external/download targets.
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      setOpenMobile(false);
    },
    [setOpenMobile],
  );

  if (isMobile) {
    return (
      <Drawer side="left" open={openMobile} onOpenChange={setOpenMobile}>
        <DrawerContent
          className={cn(
            'w-3/4 max-w-(--sidebar-width-mobile) overflow-hidden rounded-none border-0 bg-surface2 shadow-xl',
            className,
          )}
        >
          <VisuallyHidden asChild>
            <DrawerTitle>Navigation</DrawerTitle>
          </VisuallyHidden>
          <VisuallyHidden asChild>
            <DrawerDescription>Primary site navigation drawer</DrawerDescription>
          </VisuallyHidden>
          <div onClick={closeOnAnchor} className="flex h-full min-h-0 flex-col overflow-hidden px-4 py-2">
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop: in-flow sidebar with resize handle.
  const currentWidth = isCollapsed ? collapsedWidth : width;
  return (
    <div
      className={cn(
        'sidebar-layout group/sidebar relative min-h-0 shrink-0 self-stretch',
        'w-(--sidebar-width)',
        'transition-[width] duration-220 ease-[cubic-bezier(0.32,0.72,0,1)]',
        'motion-reduce:transition-none',
        'in-data-[sidebar-gesture=active]:transition-none',
        className,
        // Order matters for tailwind-merge: these win over consumer-supplied border classes.
        isHidden && 'border-r-0 border-transparent',
      )}
    >
      <div
        className={cn(
          'flex h-full min-h-0 flex-col overflow-hidden',
          'transition-opacity duration-200 motion-reduce:transition-none',
          'px-2',
          isHidden && 'pointer-events-none px-0 opacity-0',
        )}
      >
        {children}
      </div>

      <div
        // Focusable window-splitter pattern (WAI-ARIA APG): `separator` with
        // value props + keyboard semantics. Click toggles; Arrow keys resize.
        role="separator"
        aria-orientation="vertical"
        // Collapsed: omit the numeric range so AT doesn't see contradictory
        // values (valuenow=0/64 inside valuemin=200..valuemax=480). `valuetext`
        // still describes the state.
        aria-valuenow={isCollapsed ? undefined : currentWidth}
        aria-valuemin={isCollapsed ? undefined : minWidth}
        aria-valuemax={isCollapsed ? undefined : maxWidth}
        aria-valuetext={isCollapsed ? 'collapsed' : `${currentWidth} pixels`}
        aria-label={`Resize sidebar. Arrow keys to resize, Enter to ${isCollapsed ? 'expand' : 'collapse'}.`}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onClick={onClick}
        onKeyDown={onKeyDown}
        className={cn(
          'group absolute top-0 -right-1 z-10 h-full w-2 cursor-col-resize touch-none',
          'flex items-center justify-center',
          'focus-visible:outline-hidden',
        )}
      >
        <ResizeHandleIndicator
          className={cn(
            'group-hover:opacity-100',
            'group-focus-visible:via-accent1 group-focus-visible:opacity-100',
            'in-data-[sidebar-gesture=active]:via-neutral6/45 in-data-[sidebar-gesture=active]:opacity-100',
          )}
        />
      </div>
    </div>
  );
}
