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
  '--thread-column': string;
  '--thread-gutter': string;
  '--thread-edge': string;
  '--thread-scrollbars': string;
};

export const cardWidthStyle: CardWidthStyle = { '--workspace-card-max': `${CARD_MAX_REM}rem` };

export const threadGeometryStyle = (scrollbarGutters: number): ThreadGeometryStyle => ({
  ...cardWidthStyle,
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

/** How much of the chat each view asks the card for; the card animates between them. */
export const cardHeightClass = {
  compact: 'h-auto',
  full: 'h-(--card-room)',
};

/** `cqh` of the page header's layer, which spans the page. */
export const cardMaxHeightClass = '[--card-room:calc(100cqh-2*var(--chat-header-top))] max-h-(--card-room)';

export type WorkspacePanelSize = keyof typeof cardHeightClass;

const popoverBoundsClass = '[--popover-room:min(40rem,80vh)] w-[min(var(--workspace-card-max),calc(100vw-1.5rem))]';

export const popoverSizeClass: Record<WorkspacePanelSize, string> = {
  compact: `h-auto min-h-0 max-h-(--popover-room) ${popoverBoundsClass}`,
  full: `h-(--popover-room) ${popoverBoundsClass}`,
};

export const treeRowContainmentClass = '[content-visibility:auto] [contain-intrinsic-size:auto_1.75rem]';

export const overviewScrollClass = 'flex min-h-0 w-full min-w-0 grow flex-col overflow-y-auto';

/** Read through descendant selectors: a variable or `group-*` variant on this box would restyle the whole transcript. */
export const panelStateAttributes = (docked: boolean, moving: boolean) => ({
  'data-panel-docked': docked || undefined,
  'data-panel-moving': moving || undefined,
});

export const reservedSpaceClass = {
  viewport: '[[data-panel-docked]_&]:pe-[calc(var(--chat-edge)+var(--workspace-files-inset))]',
  header: 'pe-3 [[data-panel-docked]_&]:pe-[calc(--spacing(3)+var(--workspace-files-header-inset))]',
  dock: 'left-0 [[data-panel-docked]_&]:left-(--workspace-files-header-inset)',
};

/** One clock for everything the dock moves, or the actions drift. */
export const reservedSpaceTransitionClass =
  'duration-0 [[data-panel-moving]_&]:duration-(--resize-dur) ease-(--resize-ease) motion-reduce:transition-none';

/** Durations repeat over the card's transition properties, so on `height` its width and right edge land at once. */
export const cardTransitionClass =
  'duration-0 data-[motion=height]:duration-[var(--resize-dur),0s] data-[motion=place]:duration-(--resize-dur) ease-(--resize-ease) motion-reduce:transition-none';
