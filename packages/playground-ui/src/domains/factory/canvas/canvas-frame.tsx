import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { PanelSheet } from './panel-sheet';
import { useInSheet } from './panel-sheet-context';
import { pinParentHeight } from './pin-parent-height';
import { useLaneGlide } from './use-lane-glide';
import { usePhoneLayout } from './use-phone-layout';
import { DrawerTitle } from '@/ds/components/Drawer';
import { Txt } from '@/ds/components/Txt';
import { IconArrowLeft } from '@/ds/icons/central/IconArrowLeft';
import { IconClock } from '@/ds/icons/central/IconClock';
import { IconMinusMedium } from '@/ds/icons/central/IconMinusMedium';
import { IconPlusMedium } from '@/ds/icons/central/IconPlusMedium';
import { overlaySurfaceStyle } from '@/ds/primitives/raised-surface';
import type { LinkComponent } from '@/ds/types/link-component';
import { cn } from '@/utils/cn';

const ZOOM_STEPS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5];

/** A floating bar's arrival, such as "Unsaved changes": it fades and rises into place over the toolbar. */
export const FLOAT_IN =
  'duration-normal ease-out-custom transition-[opacity,translate] starting:opacity-0 motion-safe:starting:translate-y-2';

/**
 * A block that grows in from nothing as it mounts, so what sits under it slides down instead of jumping; with
 * `enter={false}` it just shows, for a block already there when its panel opened. The few pixels of slack around the
 * clipped content keep focus rings and cell outlines whole. `className` sits on the outer box, say a negative margin
 * that cancels the parent's gap while the block is closed.
 */
export function GrowIn({
  enter = true,
  className,
  children,
}: {
  enter?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'grid grid-rows-[1fr]',
        enter &&
          'transition-[grid-template-rows,opacity] duration-normal ease-out-custom motion-reduce:transition-none starting:grid-rows-[0fr] starting:opacity-0',
        className,
      )}
    >
      <div className="-m-1 min-h-0 overflow-hidden p-1">{children}</div>
    </div>
  );
}

const TAB = 'text-column flex h-6.5 items-center rounded-full px-2.5';

/** One of the board's views in the tabs, lit while it's the page shown. */
function ViewTab({
  href,
  current,
  LinkComponent: Link,
  children,
}: {
  href: string;
  current: boolean;
  LinkComponent: LinkComponent;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? 'page' : undefined}
      className={cn(
        TAB,
        current ? 'bg-fill-hover text-foreground shadow-rim' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </Link>
  );
}

/** Cards, the board's settings and routing: the three views of one board, after whatever the host puts first. */
export function CanvasViewTabs({
  cardsHref,
  settingsHref,
  routingHref,
  active,
  leading,
  LinkComponent: Link,
}: {
  cardsHref: string;
  settingsHref: string;
  routingHref: string;
  active: 'settings' | 'routing';
  /** Shown before the tabs, such as the host's sidebar toggle. */
  leading?: ReactNode;
  LinkComponent: LinkComponent;
}) {
  return (
    <div className="flex items-center gap-2">
      {leading}
      <nav
        aria-label="Board views"
        className="flex h-8 items-center gap-2 rounded-2xl bg-card p-0.75 pl-2.5 shadow-rim"
      >
        <Link href={cardsHref} className="flex items-center gap-1.5 rounded-full pr-1 text-column text-foreground">
          <IconArrowLeft className="size-icon-xs" aria-hidden />
          Cards
        </Link>
        <span className="h-3.5 w-px bg-border" aria-hidden />
        <div className="flex gap-0.5">
          <ViewTab href={settingsHref} current={active === 'settings'} LinkComponent={Link}>
            Board settings
          </ViewTab>
          <ViewTab href={routingHref} current={active === 'routing'} LinkComponent={Link}>
            Routing
          </ViewTab>
        </div>
      </nav>
    </div>
  );
}

/** The window every count on the canvas covers. */
function PeriodLabel() {
  return (
    <div className="flex h-8 items-center gap-1.5 rounded-2xl bg-card px-3 shadow-rim">
      <IconClock className="size-icon-xs text-muted-foreground" aria-hidden />
      <Txt as="span" variant="caption" tone="muted">
        Last 30 days
      </Txt>
    </div>
  );
}

/**
 * One side panel: a phase, a rule or a test. On a desktop it fills the dock's card, scrolling once it's taller than
 * the canvas, and fades in whenever it opens or takes another's place; on a phone it fills the bottom sheet.
 */
export function SidePanel({ label, children }: { label: string; children: ReactNode }) {
  const sheet = useInSheet();
  if (sheet) {
    return (
      <aside aria-label={label} className="flex flex-col gap-4 px-3.5 pt-1 pb-4">
        <DrawerTitle className="sr-only">{label}</DrawerTitle>
        {children}
      </aside>
    );
  }
  return (
    <aside
      aria-label={label}
      className={cn(
        'flex max-h-[100cqh] flex-col gap-4 overflow-y-auto px-3.5 pt-3.5 pb-4',
        'transition-opacity duration-fast ease-out-custom starting:opacity-0',
      )}
    >
      {children}
    </aside>
  );
}

/** An open side panel, and how to close it when a phone's sheet is swiped away. */
type PanelSlot = { content: ReactNode; onClose: () => void };

/**
 * The desktop side panel's card, docked top right over the canvas. It slides in as a panel opens and stays while one
 * panel takes another's place, easing to the new one's height; on closing it holds the last panel to slide out with.
 */
function PanelDock({ panel }: { panel: PanelSlot | undefined }) {
  const surface = useRef<HTMLDivElement>(null);
  const [held, setHeld] = useState(panel);
  if (panel && panel !== held) setHeld(panel);
  const shown = panel ?? held;
  const leaving = !panel && held !== undefined;

  // Lets go of the closed panel once its card has slid out, or at once where nothing animates. A panel opening
  // mid-way cancels the slide, and with it the release.
  useEffect(() => {
    const card = surface.current;
    if (!leaving || !card) return;
    let stale = false;
    const sliding = typeof card.getAnimations === 'function' ? card.getAnimations() : [];
    Promise.all(sliding.map(animation => animation.finished)).then(
      () => {
        if (!stale) setHeld(undefined);
      },
      () => undefined,
    );
    return () => {
      stale = true;
    };
  }, [leaving]);

  if (!shown) return null;

  return (
    // A size container, so the panel inside can cap its height at the dock's while the card eases its own.
    <div className="[container-type:size] pointer-events-none absolute top-15.5 right-4 bottom-18 w-100">
      <div
        ref={surface}
        inert={leaving}
        className={cn(
          overlaySurfaceStyle,
          'pointer-events-auto overflow-hidden rounded-card',
          'transition-[opacity,translate,height] duration-normal ease-out-custom motion-reduce:h-auto! motion-reduce:transition-opacity',
          'starting:opacity-0 motion-safe:starting:translate-x-3',
          leaving && 'pointer-events-none opacity-0 duration-fast motion-safe:translate-x-3',
        )}
      >
        <div ref={pinParentHeight}>{shown.content}</div>
      </div>
    </div>
  );
}

/**
 * The canvas page: the page's header and the flow scroll underneath, only the flow zooms, the view tabs float top left,
 * the period top right with the side panel under it, and the toolbar at the bottom. The flow and toolbar center on the
 * canvas; an open panel docks over its right edge, and the flow slides out from under it only as far as it must. On a
 * phone the tabs scroll away with the flow, which fits the screen's width, and the panel opens in a bottom sheet.
 */
export function CanvasFrame({
  label,
  tabs,
  header,
  panel,
  bar,
  status,
  children,
}: {
  label: string;
  tabs: ReactNode;
  header?: ReactNode;
  panel?: PanelSlot;
  bar?: ReactNode;
  /** A loading or error state filling the canvas in place of the flow, with the tabs still there to leave by. */
  status?: ReactNode;
  children?: ReactNode;
}) {
  const [zoom, setZoom] = useState(1);
  const step = ZOOM_STEPS.indexOf(zoom);
  const phone = usePhoneLayout();
  const tabsInFlow = phone && !status;
  const { flow, lane } = useLaneGlide(panel !== undefined);

  return (
    <div className="relative size-full min-h-0 overflow-hidden">
      {/* Isolated, so a dragged row raised over its neighbors still passes under the floating panel and bars. */}
      <section aria-label={label} className="absolute inset-0 isolate overflow-auto">
        {status ? (
          <div className="flex size-full pt-16">{status}</div>
        ) : (
          <div className="flex w-max min-w-full items-start px-6 pt-21 pb-40 max-sm:w-full max-sm:px-4 max-sm:pt-5.5">
            <span aria-hidden className="flex-1" />
            <div ref={flow} className="shrink-0 max-sm:w-full">
              {tabsInFlow && <div className="mb-8">{tabs}</div>}
              {header}
              <div style={{ zoom }}>{children}</div>
            </div>
            {/* The lane the panel takes: it only pushes the flow over once the space beside the flow is narrower. */}
            <span ref={lane} aria-hidden className="flex-1 sm:data-open:min-w-102" />
          </div>
        )}
      </section>

      {!tabsInFlow && <div className="pointer-events-none absolute top-5.5 left-4 *:pointer-events-auto">{tabs}</div>}
      <div className="pointer-events-none absolute top-5.5 right-4 *:pointer-events-auto max-sm:hidden">
        <PeriodLabel />
      </div>

      {phone ? panel && <PanelSheet onClose={panel.onClose}>{panel.content}</PanelSheet> : <PanelDock panel={panel} />}

      {/* Without a panel, it centers on the canvas, clear of the zoom control on either side. */}
      {bar && (
        <div
          className={cn(
            'pointer-events-none absolute inset-x-0 bottom-6 flex flex-col items-center gap-3 px-4 *:pointer-events-auto',
            'transition-[right,padding] duration-normal ease-out-custom motion-reduce:transition-none',
            panel ? 'sm:right-104' : 'md:px-32',
          )}
        >
          {bar}
        </div>
      )}

      <div className="absolute right-4 bottom-8 flex h-8 items-center gap-2.5 rounded-2xl bg-card px-2.5 shadow-rim max-md:hidden">
        <button
          type="button"
          aria-label="Zoom out"
          disabled={!!status || step <= 0}
          onClick={() => setZoom(ZOOM_STEPS[step - 1] ?? zoom)}
          className="text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          <IconMinusMedium className="size-icon-xs" aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Reset zoom"
          disabled={!!status}
          onClick={() => setZoom(1)}
          className="w-9 text-caption text-muted-foreground tabular-nums hover:text-foreground"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          disabled={!!status || step >= ZOOM_STEPS.length - 1}
          onClick={() => setZoom(ZOOM_STEPS[step + 1] ?? zoom)}
          className="text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          <IconPlusMedium className="size-icon-xs" aria-hidden />
        </button>
      </div>
    </div>
  );
}
