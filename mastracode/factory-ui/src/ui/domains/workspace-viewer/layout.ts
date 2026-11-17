import type { CSSProperties } from 'react';

const COLUMN_REM = 44;
const GUTTER_REM = 1.5;
const EDGE_REM = 0.5;
const CARD_MIN_REM = 21;
const CARD_MAX_REM = 34;

// JS gates mounts at the two container thresholds; CSS below owns the panel geometry.
export const DOCK_MIN_REM = COLUMN_REM + 2 * GUTTER_REM + 2 * EDGE_REM + CARD_MIN_REM;
export const RAIL_MIN_REM = 58;

type CardWidthStyle = CSSProperties & { '--workspace-card-max': string };
type ThreadGeometryStyle = CardWidthStyle & {
  '--workspace-card-min': string;
  '--thread-column': string;
  '--thread-gutter': string;
  '--thread-edge': string;
  '--thread-scrollbars': string;
};

export const cardWidthStyle: CardWidthStyle = { '--workspace-card-max': `${CARD_MAX_REM}rem` };

export const threadGeometryStyle = (scrollbarGutters: number): ThreadGeometryStyle => ({
  ...cardWidthStyle,
  '--workspace-card-min': `${CARD_MIN_REM}rem`,
  '--thread-column': `${COLUMN_REM}rem`,
  '--thread-gutter': `${GUTTER_REM}rem`,
  '--thread-edge': `${EDGE_REM}rem`,
  '--thread-scrollbars': `${scrollbarGutters}px`,
});

/** `cqw`, not `%`: a percentage would resolve in whichever box reads the variable. */
export const threadGeometryClass = [
  '[--workspace-files-card:min(var(--workspace-card-max),calc(100cqw-var(--thread-column)-2*var(--thread-gutter)-2*var(--thread-edge)-var(--thread-scrollbars)))]',
  '[--workspace-files-inset:calc(var(--workspace-files-card)+2*var(--thread-gutter))]',
  '[--workspace-files-header-inset:calc(var(--workspace-files-card)+var(--thread-gutter))]',
].join(' ');
export const chatColumnClass = '[--chat-column:var(--thread-column)] [--chat-edge:var(--thread-edge)]';

/** The composer sits a touch wider than the transcript, at every width: it keeps the
 * reading column but gives back most of its gutter, so it reads as the page's input
 * rather than another message. */
export const composerColumnClass = 'px-1 md:px-1';

/** Concentric with the pill rows it wraps: their radius (`h-control-sm` ÷ 2) plus the
 * 6px inset (`p-1.5`) and the 1px border that sit between them and the card edge. */
export const cardRadiusClass = 'rounded-[calc(var(--spacing-control-sm)/2+7px)]';

/** A percentage, not a length: a taller window then moves the card without restarting its height transition. */
export const cardHeightClass = {
  compact: 'h-auto',
  full: 'h-full',
};

/** `cqh` of the page header's layer, which spans the page. */
export const cardTrackClass = 'h-[calc(100cqh-2*var(--chat-header-top))]';

export type WorkspacePanelSize = keyof typeof cardHeightClass;

const popoverBoundsClass = '[--popover-room:min(40rem,80vh)] w-[min(var(--workspace-card-max),calc(100vw-1.5rem))]';

export const popoverSizeClass: Record<WorkspacePanelSize, string> = {
  compact: `h-auto min-h-0 max-h-(--popover-room) ${popoverBoundsClass}`,
  full: `h-(--popover-room) ${popoverBoundsClass}`,
};

export const treeRowContainmentClass = '[content-visibility:auto] [contain-intrinsic-size:auto_1.75rem]';

export const overviewScrollClass = 'flex min-h-0 w-full min-w-0 grow flex-col overflow-y-auto';

/** Read through descendant selectors: a variable or `group-*` variant on this box would restyle the whole transcript. */
export const panelStateAttributes = (docked: boolean, moved: boolean) => ({
  'data-panel-docked': docked || undefined,
  'data-panel-moved': moved || undefined,
});

// Instant until the panel first moves: the first measurement follows a layout, and would unfold the panel on page load.
const motionClock =
  'duration-0 [[data-panel-moved]_&]:duration-(--resize-dur) ease-(--resize-ease) motion-reduce:transition-none';

/** Only `--panel-reveal` transitions; geometry is that value times live sizes, so a resize mid-motion never cancels it. */
export const panelRevealClass = `[[data-panel-docked]_&]:[--panel-reveal:1] [transition-property:--panel-reveal] ${motionClock}`;

export const reservedSpaceClass = {
  viewport: `${panelRevealClass} pe-[calc(var(--chat-edge)+var(--chat-inset-end)+var(--panel-reveal)*var(--workspace-files-inset))]`,
  header: `${panelRevealClass} pe-[calc(--spacing(3)+var(--panel-reveal)*var(--workspace-files-header-inset))]`,
  dock: `${panelRevealClass} left-[calc(var(--panel-reveal)*var(--workspace-files-header-inset))]`,
};

export const cardMotionClass = `${motionClock} data-resized:duration-(--resize-dur)`;
