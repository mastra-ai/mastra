// JS gates mounts at the two container thresholds; CSS below owns the panel geometry.
export const DOCK_MIN_REM = 68;
export const RAIL_MIN_REM = 58;

export const threadGeometryClass = '[--thread-column:44rem] [--thread-gutter:1.5rem] [--workspace-card-width:21rem]';
export const chatColumnClass = '[--chat-column:var(--thread-column)]';

/** The composer sits a touch wider than the transcript, at every width: it keeps the
 * reading column but gives back most of its gutter, so it reads as the page's input
 * rather than another message. */
export const composerColumnClass = 'px-1 md:px-1';

/** Concentric with the pill rows it wraps: their radius (`h-form-sm` ÷ 2) plus the
 * 6px inset (`p-1.5`) and the 1px border that sit between them and the card edge. */
export const cardRadiusClass = 'rounded-[calc(var(--spacing-form-sm)/2+7px)]';

/** How much of the chat each view asks the card for; the card animates between them.
 * `min-h-0` keeps both ends of the `half` transition numeric. */
export const cardHeightClass = {
  compact: 'h-auto min-h-0',
  half: 'h-auto min-h-[50%]',
  full: 'h-full min-h-0',
};

export type WorkspacePanelSize = keyof typeof cardHeightClass;

const wideCardClass =
  '[--workspace-files-card:min(34rem,calc(100%-var(--thread-column)-var(--thread-gutter)-var(--thread-gutter)))]';

export const cardWidthClass: Record<WorkspacePanelSize, string> = {
  compact: '[--workspace-files-card:var(--workspace-card-width)]',
  half: wideCardClass,
  full: wideCardClass,
};

const popoverWidthClass = 'w-[min(34rem,calc(100vw-1.5rem))]';
const popoverMaxHeightClass = 'max-h-[min(40rem,80vh)]';

export const popoverSizeClass: Record<WorkspacePanelSize, string> = {
  compact: `h-auto min-h-0 ${popoverMaxHeightClass} w-[min(21rem,calc(100vw-1.5rem))]`,
  half: `h-auto min-h-[min(24rem,60vh)] ${popoverMaxHeightClass} ${popoverWidthClass}`,
  full: `h-[min(40rem,80vh)] ${popoverWidthClass}`,
};

export const treeRowContainmentClass = '[content-visibility:auto] [contain-intrinsic-size:auto_1.75rem]';

/** The chat shell maps this onto `--chat-inset-end`, which pads its scroller. */
export const reservedSpaceClass = {
  none: '[--workspace-files-inset:0px]',
  docked: '[--workspace-files-inset:calc(var(--workspace-files-card)+var(--thread-gutter)+var(--thread-gutter))]',
};
