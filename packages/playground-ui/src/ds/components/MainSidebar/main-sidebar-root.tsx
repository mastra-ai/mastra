import * as DialogPrimitive from '@radix-ui/react-dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { useCallback, useEffect, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useMainSidebar } from './main-sidebar-context';
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

      const startX = event.clientX;

      const handle = event.currentTarget;
      const pointerId = event.pointerId;

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
          setGestureActive(true);
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

  // Mobile: render as an off-canvas drawer via Radix Dialog.
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
      <DialogPrimitive.Root open={openMobile} onOpenChange={setOpenMobile}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            className={cn(
              'fixed inset-0 z-40 bg-overlay backdrop-blur-sm',
              'data-[state=open]:animate-in data-[state=closed]:animate-out',
              'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
            )}
          />
          <DialogPrimitive.Content
            className={cn(
              'fixed inset-y-0 left-0 z-50 flex h-full flex-col',
              'w-3/4 max-w-(--sidebar-width-mobile)',
              'bg-surface2 shadow-xl',
              'data-[state=open]:animate-in data-[state=closed]:animate-out',
              'data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left',
              'duration-200',
              className,
            )}
          >
            <VisuallyHidden asChild>
              <DialogPrimitive.Title>Navigation</DialogPrimitive.Title>
            </VisuallyHidden>
            <VisuallyHidden asChild>
              <DialogPrimitive.Description>Primary site navigation drawer</DialogPrimitive.Description>
            </VisuallyHidden>
            <div onClick={closeOnAnchor} className="flex flex-col h-full min-h-0 px-4 py-2 overflow-hidden">
              {children}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    );
  }

  // Desktop: in-flow sidebar with resize handle.
  const currentWidth = isCollapsed ? collapsedWidth : width;
  return (
    <div
      className={cn(
        'sidebar-layout group/sidebar relative shrink-0 self-stretch min-h-0',
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
          'flex flex-col h-full min-h-0 overflow-hidden',
          'transition-opacity duration-200 motion-reduce:transition-none',
          isCollapsed ? 'px-2' : 'px-4',
          isHidden && 'opacity-0 pointer-events-none px-0',
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
        <span
          aria-hidden
          className={cn(
            'block h-10 w-0.5 translate-x-0 group-hover:translate-x-1.5 rounded-full bg-transparent scale-50 group-hover:scale-100',
            'transition duration-150 ease-out motion-reduce:transition-none pointer-events-none',
            'group-hover:bg-surface5',
            'group-focus-visible:bg-accent1',
            'in-data-[sidebar-gesture=active]:bg-accent1',
          )}
        />
      </div>
    </div>
  );
}
