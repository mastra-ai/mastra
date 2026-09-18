import '../../../../new-theme.css';
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
  const dragCleanupRef = useRef<(() => void) | null>(null);

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
      setGestureActive(true);

      const startX = event.clientX;
      const handle = event.currentTarget;
      const pointerId = event.pointerId;

      try {
        handle.setPointerCapture(pointerId);
      } catch {
        // The pointer may have ended before capture.
      }

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

  // Client-side routers preventDefault but should still close the drawer.
  const closeOnAnchor = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const anchor = (event.target as HTMLElement).closest('a');
      if (!anchor || !anchor.hasAttribute('href')) return;

      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

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
            'new-theme w-3/4 max-w-(--sidebar-width-mobile) overflow-hidden rounded-none border-0 bg-sidebar text-foreground shadow-xl',
            className,
          )}
        >
          <VisuallyHidden asChild>
            <DrawerTitle>Navigation</DrawerTitle>
          </VisuallyHidden>
          <VisuallyHidden asChild>
            <DrawerDescription>Primary site navigation drawer</DrawerDescription>
          </VisuallyHidden>
          <div onClick={closeOnAnchor} className="flex h-full min-h-0 flex-col overflow-hidden px-3 py-2">
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  const currentWidth = isCollapsed ? collapsedWidth : width;
  return (
    <div
      className={cn(
        'new-theme sidebar-layout group/sidebar relative min-h-0 shrink-0 self-stretch bg-sidebar text-foreground',
        'w-(--sidebar-width)',
        'transition-[width] duration-220 ease-[cubic-bezier(0.32,0.72,0,1)]',
        'motion-reduce:transition-none',
        'in-data-[sidebar-gesture=active]:transition-none',
        className,

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
        role="separator"
        aria-orientation="vertical"

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
            'via-foreground/30 group-hover:opacity-100',
            'group-focus-visible:via-accent1 group-focus-visible:opacity-100',
            'in-data-[sidebar-gesture=active]:via-foreground/45 in-data-[sidebar-gesture=active]:opacity-100',
          )}
        />
      </div>
    </div>
  );
}
