import React from 'react';
import type { CSSProperties } from 'react';
import type { LinkComponent } from '@/ds/types/link-component';

const SIDEBAR_STATE_KEY = 'sidebar:state';
const SIDEBAR_WIDTH_KEY = 'sidebar:width';

const SIDEBAR_WIDTH_VAR = '--sidebar-width';

export type SidebarState = 'default' | 'collapsed';

type MainSidebarContext = {
  state: SidebarState;
  desktopState: SidebarState;
  width: number;
  minWidth: number;
  maxWidth: number;
  collapseBelow: number;
  collapsedWidth: number;
  isMobile: boolean;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  toggleSidebar: () => void;
  setWidth: (width: number) => void;
  collapse: () => void;
  expand: () => void;
  commit: () => void;
  setGestureActive: (active: boolean) => void;
  LinkComponent?: LinkComponent;
};

// Split: drawer open-state lives in its own context so NavLink/NavHeader
// do not re-render when the mobile drawer toggles.
type MobileDrawerContext = {
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
};

const MainSidebarContext = React.createContext<Omit<MainSidebarContext, 'openMobile' | 'setOpenMobile'> | null>(null);
const MobileDrawerContext = React.createContext<MobileDrawerContext | null>(null);

export function useMainSidebar(): MainSidebarContext {
  const ctx = React.useContext(MainSidebarContext);
  const drawer = React.useContext(MobileDrawerContext);
  if (!ctx || !drawer) {
    throw new Error('useMainSidebar must be used within a MainSidebarProvider.');
  }
  return { ...ctx, ...drawer };
}

export function useMaybeSidebar(): MainSidebarContext | null {
  const ctx = React.useContext(MainSidebarContext);
  const drawer = React.useContext(MobileDrawerContext);
  if (!ctx || !drawer) return null;
  return { ...ctx, ...drawer };
}

/** Reads only mobile drawer state. Cheap — no re-renders on sidebar resize. */
export function useMobileDrawer(): MobileDrawerContext {
  const drawer = React.useContext(MobileDrawerContext);
  if (!drawer) throw new Error('useMobileDrawer must be used within a MainSidebarProvider.');
  return drawer;
}

export type MainSidebarProviderProps = {
  children: React.ReactNode;
  /** Initial state before localStorage hydrates. Defaults to `'default'`. */
  defaultState?: SidebarState;
  /** Default expanded width in px. Defaults to `240`. */
  defaultWidth?: number;
  /** Minimum draggable width in px. Defaults to `200`. */
  minWidth?: number;
  /** Maximum draggable width in px. Defaults to `480`. */
  maxWidth?: number;
  /** Drag below this value snaps the sidebar closed. Defaults to `minWidth` (snap to collapsed when dragged below the expanded minimum). Pass `0` to disable snap. */
  collapseBelow?: number;
  /** Width in px when collapsed. Defaults to `64`. Set to `0` for fully hidden. */
  collapsedWidth?: number;
  /** Disable the global ⌘B / Ctrl+B toggle shortcut. Defaults to `false`. */
  disableKeyboardShortcut?: boolean;
  /** Scope-key for localStorage. Allows multiple independent sidebars per app. */
  storageKey?: string;
  /** Mobile breakpoint in px (max-width). Below this, sidebar renders as a drawer. Defaults to `1024`. */
  mobileBreakpoint?: number;
  /** Drawer max-width on mobile in px. Actual width is `min(75vw, mobileWidth)`. Defaults to `360`. */
  mobileWidth?: number;
  /** Default LinkComponent injected into NavLink/NavHeader. Falls back to plain `<a>` if omitted. */
  LinkComponent?: LinkComponent;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const useIsoLayoutEffect = typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

export function MainSidebarProvider({
  children,
  defaultState = 'default',
  defaultWidth = 240,
  minWidth = 200,
  maxWidth = 480,
  collapseBelow,
  collapsedWidth = 64,
  disableKeyboardShortcut = false,
  storageKey,
  mobileBreakpoint = 1024,
  mobileWidth = 360,
  LinkComponent,
}: MainSidebarProviderProps) {
  // Normalize props so bad inputs (defaultWidth < minWidth, min > max, etc.) never produce a broken layout.
  const safeMin = Math.max(0, Math.min(minWidth, maxWidth));
  const safeMax = Math.max(safeMin, maxWidth);
  const safeCollapsed = Math.max(0, Math.min(collapsedWidth, safeMax));
  const safeDefault = clamp(defaultWidth, safeMin, safeMax);
  // Default snap-zone = minWidth: dragging below the expanded min snaps to collapsed,
  // since below min the sidebar cannot render its expanded layout anyway.
  // Pass `collapseBelow={0}` to disable snap.
  const safeCollapseBelow = collapseBelow ?? safeMin;

  const stateStorageKey = storageKey ? `${storageKey}:${SIDEBAR_STATE_KEY}` : SIDEBAR_STATE_KEY;
  const widthStorageKey = storageKey ? `${storageKey}:${SIDEBAR_WIDTH_KEY}` : SIDEBAR_WIDTH_KEY;

  // Hydrate synchronously from localStorage so first paint is already at the correct width.
  // Falls back to clamped defaults during SSR or when storage is unavailable.
  const readInitial = (): { state: SidebarState; width: number } => {
    if (typeof window === 'undefined') return { state: defaultState, width: safeDefault };
    try {
      let nextState: SidebarState = defaultState;
      let nextWidth = safeDefault;
      const storedState = window.localStorage.getItem(stateStorageKey);
      if (storedState === 'collapsed' || storedState === 'default') nextState = storedState;
      const storedWidth = window.localStorage.getItem(widthStorageKey);
      if (storedWidth !== null) {
        const parsed = Number(storedWidth);
        if (Number.isFinite(parsed)) nextWidth = clamp(parsed, safeMin, safeMax);
      }
      return { state: nextState, width: nextWidth };
    } catch {
      return { state: defaultState, width: safeDefault };
    }
  };
  const initialRef = React.useRef<{ state: SidebarState; width: number } | null>(null);
  if (initialRef.current === null) initialRef.current = readInitial();
  const initial = initialRef.current;

  const [state, setState] = React.useState<SidebarState>(initial.state);
  const [width, setWidthState] = React.useState<number>(initial.width);
  const [isMobile, setIsMobile] = React.useState(false);
  const [openMobile, setOpenMobile] = React.useState(false);
  const widthRef = React.useRef<number>(initial.width);
  const stateRef = React.useRef<SidebarState>(initial.state);
  stateRef.current = state;

  const scopeRef = React.useRef<HTMLDivElement | null>(null);

  // Watch viewport for mobile breakpoint.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(`(max-width: ${mobileBreakpoint - 1}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [mobileBreakpoint]);

  // Close mobile drawer when crossing back to desktop.
  React.useEffect(() => {
    if (!isMobile && openMobile) setOpenMobile(false);
  }, [isMobile, openMobile]);

  const writeCssVar = React.useCallback((px: number) => {
    const el = scopeRef.current;
    if (el) el.style.setProperty(SIDEBAR_WIDTH_VAR, `${px}px`);
  }, []);

  // Keep the CSS var in sync with collapsed state transitions.
  useIsoLayoutEffect(() => {
    writeCssVar(state === 'collapsed' ? safeCollapsed : widthRef.current);
  }, [state, safeCollapsed, writeCssVar]);

  const persistState = React.useCallback(
    (next: SidebarState) => {
      try {
        window.localStorage.setItem(stateStorageKey, next);
      } catch {}
    },
    [stateStorageKey],
  );

  const toggleSidebar = React.useCallback(() => {
    if (isMobile) {
      setOpenMobile(prev => !prev);
      return;
    }
    setState(prev => {
      const next = prev === 'default' ? 'collapsed' : 'default';
      // Sync ref so a synchronous follow-up `commit()` (e.g. keyboard handler)
      // persists the new state instead of the stale render-time value.
      stateRef.current = next;
      persistState(next);
      return next;
    });
  }, [isMobile, persistState]);

  const setWidth = React.useCallback(
    (next: number) => {
      const clamped = clamp(next, safeMin, safeMax);
      widthRef.current = clamped;
      writeCssVar(clamped);
    },
    [safeMin, safeMax, writeCssVar],
  );

  const collapse = React.useCallback(() => {
    stateRef.current = 'collapsed';
    persistState('collapsed');
    setState('collapsed');
  }, [persistState]);
  const expand = React.useCallback(() => {
    stateRef.current = 'default';
    persistState('default');
    setState('default');
  }, [persistState]);

  const commit = React.useCallback(() => {
    setWidthState(widthRef.current);
    try {
      window.localStorage.setItem(stateStorageKey, stateRef.current);
      window.localStorage.setItem(widthStorageKey, String(widthRef.current));
    } catch {}
  }, [stateStorageKey, widthStorageKey]);

  const setGestureActive = React.useCallback((active: boolean) => {
    const el = scopeRef.current;
    if (!el) return;
    if (active) el.setAttribute('data-sidebar-gesture', 'active');
    else el.removeAttribute('data-sidebar-gesture');
  }, []);

  // Global ⌘B / Ctrl+B toggle. Skip when typing.
  React.useEffect(() => {
    if (disableKeyboardShortcut) return;
    const onKeyDown = (ev: KeyboardEvent) => {
      // `code` is layout-independent — works on non-Latin keyboards.
      if (ev.code !== 'KeyB') return;
      if (!(ev.metaKey || ev.ctrlKey)) return;
      if (ev.altKey || ev.shiftKey) return;
      const target = ev.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (target.isContentEditable) return;
      }
      ev.preventDefault();
      toggleSidebar();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [disableKeyboardShortcut, toggleSidebar]);

  const effectiveState: SidebarState = isMobile ? 'default' : state;

  const contextValue = React.useMemo(
    () => ({
      state: effectiveState,
      desktopState: state,
      width,
      minWidth: safeMin,
      maxWidth: safeMax,
      collapseBelow: safeCollapseBelow,
      collapsedWidth: safeCollapsed,
      isMobile,
      toggleSidebar,
      setWidth,
      collapse,
      expand,
      commit,
      setGestureActive,
      LinkComponent,
    }),
    [
      effectiveState,
      state,
      width,
      safeMin,
      safeMax,
      safeCollapseBelow,
      safeCollapsed,
      isMobile,
      toggleSidebar,
      setWidth,
      collapse,
      expand,
      commit,
      setGestureActive,
      LinkComponent,
    ],
  );

  const drawerValue = React.useMemo<MobileDrawerContext>(() => ({ openMobile, setOpenMobile }), [openMobile]);

  // CSS var owned exclusively by writeCssVar (single source of truth).
  // SSR seeds the initial value here; post-mount writeCssVar takes over.
  const scopeStyle: CSSProperties = {
    [SIDEBAR_WIDTH_VAR]: `${initial.state === 'collapsed' ? safeCollapsed : initial.width}px`,
    ['--sidebar-width-mobile' as string]: `${mobileWidth}px`,
    display: 'contents',
  } as CSSProperties;

  return (
    <div
      ref={scopeRef}
      data-sidebar-scope
      data-sidebar-state={state}
      data-sidebar-mobile={isMobile ? 'true' : 'false'}
      style={scopeStyle}
      suppressHydrationWarning
    >
      <MainSidebarContext.Provider value={contextValue}>
        <MobileDrawerContext.Provider value={drawerValue}>{children}</MobileDrawerContext.Provider>
      </MainSidebarContext.Provider>
    </div>
  );
}
