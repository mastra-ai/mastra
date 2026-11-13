import React from 'react';
import type { CSSProperties } from 'react';
import { SidebarContext, MobileDrawerContext } from './sidebar-context';
import type { MobileDrawerContextValue, SidebarMotion, SidebarState, SidebarSwitchOptions } from './sidebar-context';
import { sidebarMotionDuration } from './sidebar-motion';
import { SIDEBAR_WIDTHS } from './sidebar-widths';
import type { LinkComponent } from '@/ds/types/link-component';

import './sidebar-motion.css';

const SIDEBAR_STATE_KEY = 'sidebar:state';
const SIDEBAR_WIDTH_KEY = 'sidebar:width';

const SIDEBAR_WIDTH_VAR = '--sidebar-width';
// How long past its duration a running width transition may take to end before the switch completes without it.
const MOTION_FALLBACK_SLACK = 500;

type InitialSidebarState = {
  state: SidebarState;
  width: number;
};

type SidebarScopeStyle = CSSProperties & {
  '--sidebar-width': string;
  '--sidebar-width-mobile': string;
};

export type SidebarProviderProps = {
  children: React.ReactNode;
  /** Initial state before localStorage hydrates. Defaults to `'default'`. */
  defaultState?: SidebarState;
  /** Default expanded width in px. Defaults to `232`. */
  defaultWidth?: number;
  /** Minimum draggable width in px. Defaults to `192`. Raise it for a view that needs more room. */
  minWidth?: number;
  /** Maximum draggable width in px. Defaults to `340`. */
  maxWidth?: number;
  /** Drag below this value snaps the sidebar closed. Defaults to `minWidth` (snap to collapsed when dragged below the expanded minimum). Pass `0` to disable snap. */
  collapseBelow?: number;
  /** Width in px when collapsed. Defaults to `60`. Set to `0` for fully hidden. */
  collapsedWidth?: number;
  /** Disable the global ⌘B / Ctrl+B toggle shortcut. Defaults to `true` so browser shortcuts are preserved. */
  disableKeyboardShortcut?: boolean;
  /** Scope-key for localStorage. Allows multiple independent sidebars per app. */
  storageKey?: string;
  /** Mobile breakpoint in px (max-width). Below this, sidebar renders as a drawer. Defaults to `1024`. */
  mobileBreakpoint?: number;
  /** Drawer max-width on mobile in px. Actual width is `min(75vw, mobileWidth)`. Defaults to `360`. */
  mobileWidth?: number;
  /** Default LinkComponent injected into SidebarLink/NavHeader. Falls back to plain `<a>` if omitted. */
  LinkComponent?: LinkComponent;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const useIsoLayoutEffect = typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

export function SidebarProvider({
  children,
  defaultState = 'default',
  defaultWidth = SIDEBAR_WIDTHS.default,
  minWidth = SIDEBAR_WIDTHS.min,
  maxWidth = SIDEBAR_WIDTHS.max,
  collapseBelow,
  collapsedWidth = SIDEBAR_WIDTHS.collapsed,
  disableKeyboardShortcut = true,
  storageKey,
  mobileBreakpoint = 1024,
  mobileWidth = 360,
  LinkComponent,
}: SidebarProviderProps) {
  const safeMin = Math.max(0, Math.min(minWidth, maxWidth));
  const safeMax = Math.max(safeMin, maxWidth);
  const safeCollapsed = Math.max(0, Math.min(collapsedWidth, safeMax));
  const safeCollapseBelow = collapseBelow ?? safeMin;

  const stateStorageKey = storageKey ? `${storageKey}:${SIDEBAR_STATE_KEY}` : SIDEBAR_STATE_KEY;
  const widthStorageKey = storageKey ? `${storageKey}:${SIDEBAR_WIDTH_KEY}` : SIDEBAR_WIDTH_KEY;

  // Read storage during render so the first paint already has the stored width. The width is kept as stored and only
  // clamped where it shows: a view that opens with raised bounds must not replace the width the user chose.
  const readInitial = (): InitialSidebarState => {
    if (typeof window === 'undefined') return { state: defaultState, width: defaultWidth };
    try {
      let nextState: SidebarState = defaultState;
      let nextWidth = defaultWidth;
      const storedState = window.localStorage.getItem(stateStorageKey);
      if (storedState === 'collapsed' || storedState === 'default') nextState = storedState;
      const storedWidth = window.localStorage.getItem(widthStorageKey);
      if (storedWidth !== null) {
        const parsed = Number(storedWidth);
        if (Number.isFinite(parsed)) nextWidth = parsed;
      }
      return { state: nextState, width: nextWidth };
    } catch {
      return { state: defaultState, width: defaultWidth };
    }
  };
  const initialRef = React.useRef<InitialSidebarState | null>(null);
  if (initialRef.current === null) initialRef.current = readInitial();
  const initial = initialRef.current;

  const [state, setState] = React.useState<SidebarState>(initial.state);
  const [width, setWidthState] = React.useState<number>(initial.width);
  const [isMobile, setIsMobile] = React.useState(false);
  const [openMobile, setOpenMobileState] = React.useState(false);
  const [mobileDrawerPresent, setMobileDrawerPresent] = React.useState(false);
  const openMobileRef = React.useRef(false);
  const mobileTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const widthRef = React.useRef<number>(initial.width);
  const stateRef = React.useRef<SidebarState>(initial.state);
  const scopeRef = React.useRef<HTMLDivElement | null>(null);
  // While the panel animates between widths, `data-sidebar-motion` on the panel says which way: items keep their
  // expanded layout and narrow with the panel (their text fades), and the rail only renders once it's done.
  const [motion, setMotion] = React.useState<SidebarMotion>();
  const motionTimerRef = React.useRef(0);
  // Which switch is current: a switch that lands mid-animation makes the earlier one's end a no-op.
  const motionIdRef = React.useRef(0);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const panelWidthRef = React.useRef<number>(
    initial.state === 'collapsed' ? safeCollapsed : clamp(initial.width, safeMin, safeMax),
  );

  React.useEffect(() => () => window.clearTimeout(motionTimerRef.current), []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(`(max-width: ${mobileBreakpoint - 1}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [mobileBreakpoint]);

  const setOpenMobile = React.useCallback((open: boolean) => {
    openMobileRef.current = open;
    if (open) setMobileDrawerPresent(true);
    setOpenMobileState(open);
  }, []);

  React.useEffect(() => {
    if (!isMobile && openMobile) {
      setOpenMobile(false);
      setMobileDrawerPresent(false);
    }
  }, [isMobile, openMobile, setOpenMobile]);

  // Written on the panel, not on the scope: the scope wraps the whole app, and a variable changed there restyles every
  // element on the page (about 100ms on a heavy page, every time). The scope keeps the first value for the first paint.
  const writeCssVar = React.useCallback((px: number) => {
    panelWidthRef.current = px;
    panelRef.current?.style.setProperty(SIDEBAR_WIDTH_VAR, `${px}px`);
  }, []);

  const setPanelElement = React.useCallback((el: HTMLDivElement | null) => {
    panelRef.current = el;
    el?.style.setProperty(SIDEBAR_WIDTH_VAR, `${panelWidthRef.current}px`);
  }, []);

  // Bounds can change at runtime (a view that needs more room raises `minWidth`). Show the stored
  // width within the current bounds without overwriting it, so the sidebar returns to the user's
  // width once the bounds relax.
  useIsoLayoutEffect(() => {
    writeCssVar(state === 'collapsed' ? safeCollapsed : clamp(widthRef.current, safeMin, safeMax));
  }, [state, safeCollapsed, safeMin, safeMax, writeCssVar]);

  const persistState = React.useCallback(
    (next: SidebarState) => {
      try {
        window.localStorage.setItem(stateStorageKey, next);
      } catch {}
    },
    [stateStorageKey],
  );

  // `stateRef` always holds where the sidebar is going, ahead of a running animation: a same-tick `commit()` (or a
  // second toggle) must act on that, not on the rendered state.
  const switchTo = React.useCallback(
    (next: SidebarState, { animate = false }: SidebarSwitchOptions = {}) => {
      window.clearTimeout(motionTimerRef.current);
      const id = ++motionIdRef.current;
      stateRef.current = next;
      persistState(next);
      // Written here, not only on a state change: a switch that lands mid-animation may not change `state`.
      writeCssVar(next === 'collapsed' ? safeCollapsed : clamp(widthRef.current, safeMin, safeMax));
      const duration = animate && scopeRef.current ? sidebarMotionDuration(scopeRef.current) : 0;
      if (duration === 0) {
        setMotion(undefined);
        setState(next);
        return;
      }

      // The panel heads for its new width with the expanded layout; collapsing, the rail renders once it's there.
      setMotion(next === 'collapsed' ? 'collapsing' : 'expanding');
      if (next === 'default') setState('default');
      const finish = () => {
        if (motionIdRef.current !== id) return;
        window.clearTimeout(motionTimerRef.current);
        setMotion(undefined);
        setState(next);
      };
      // Ends with the width transition itself, not a timer from the click: on a busy page the transition starts
      // late, and a timer would swap in the rail while the panel is still wide. The timer stays as a fallback for
      // when no transition runs (the width didn't change, or the app's CSS turned it off).
      const transition = panelRef.current
        ?.getAnimations?.()
        .find(animation => 'transitionProperty' in animation && animation.transitionProperty === 'width');
      transition?.finished.then(finish, () => {});
      motionTimerRef.current = window.setTimeout(finish, transition ? duration + MOTION_FALLBACK_SLACK : duration);
    },
    [persistState, safeMin, safeMax, safeCollapsed, writeCssVar],
  );

  const toggleSidebar = React.useCallback(() => {
    if (isMobile) {
      setOpenMobile(!openMobileRef.current);
      return;
    }
    switchTo(stateRef.current === 'collapsed' ? 'default' : 'collapsed', { animate: true });
  }, [isMobile, setOpenMobile, switchTo]);

  const setWidth = React.useCallback(
    (next: number) => {
      const clamped = clamp(next, safeMin, safeMax);
      widthRef.current = clamped;
      writeCssVar(clamped);
    },
    [safeMin, safeMax, writeCssVar],
  );

  const collapse = React.useCallback((options?: SidebarSwitchOptions) => switchTo('collapsed', options), [switchTo]);
  const expand = React.useCallback((options?: SidebarSwitchOptions) => switchTo('default', options), [switchTo]);

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

  React.useEffect(() => {
    if (disableKeyboardShortcut) return;
    const onKeyDown = (ev: KeyboardEvent) => {
      // `code` is layout-independent — works on non-Latin keyboards.
      if (ev.code !== 'KeyB') return;
      if (!(ev.metaKey || ev.ctrlKey)) return;
      if (ev.altKey || ev.shiftKey) return;
      if (ev.target instanceof HTMLElement) {
        const tag = ev.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (ev.target.isContentEditable) return;
      }
      ev.preventDefault();
      toggleSidebar();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [disableKeyboardShortcut, toggleSidebar]);

  const effectiveState: SidebarState = isMobile ? 'default' : state;
  const visibleWidth = clamp(width, safeMin, safeMax);

  const contextValue = React.useMemo(
    () => ({
      state: effectiveState,
      desktopState: state,
      width: visibleWidth,
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
      motion,
      setPanelElement,
      LinkComponent,
    }),
    [
      effectiveState,
      state,
      visibleWidth,
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
      motion,
      setPanelElement,
      LinkComponent,
    ],
  );

  const drawerValue = React.useMemo<MobileDrawerContextValue>(
    () => ({ openMobile, mobileTriggerRef, setOpenMobile, setMobileDrawerPresent }),
    [openMobile, setOpenMobile],
  );

  const scopeStyle: SidebarScopeStyle = {
    [SIDEBAR_WIDTH_VAR]: `${initial.state === 'collapsed' ? safeCollapsed : clamp(initial.width, safeMin, safeMax)}px`,
    '--sidebar-width-mobile': `${mobileWidth}px`,
    display: 'contents',
  };

  return (
    <div
      ref={scopeRef}
      data-sidebar-scope
      data-sidebar-state={state}
      data-sidebar-mobile={isMobile ? 'true' : 'false'}
      data-sidebar-mobile-present={mobileDrawerPresent ? 'true' : 'false'}
      style={scopeStyle}
      suppressHydrationWarning
    >
      <SidebarContext.Provider value={contextValue}>
        <MobileDrawerContext.Provider value={drawerValue}>{children}</MobileDrawerContext.Provider>
      </SidebarContext.Provider>
    </div>
  );
}
