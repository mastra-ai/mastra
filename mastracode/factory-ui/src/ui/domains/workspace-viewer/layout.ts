// JS gates mounts at the two container thresholds; CSS below owns the panel geometry.
export const DOCK_MIN_REM = 68;
export const RAIL_MIN_REM = 58;

export const threadGeometryClass = '[--thread-column:44rem] [--thread-gutter:1.5rem] [--workspace-card-width:21rem]';
export const chatColumnClass = '[--chat-column:var(--thread-column)]';

export const cardWidthClass = {
  compact: '[--workspace-files-card:var(--workspace-card-width)]',
  expanded:
    '[--workspace-files-card:min(34rem,calc(100%-var(--thread-column)-var(--thread-gutter)-var(--thread-gutter)))]',
};

export const compactHeightClass = 'h-auto';
export const popoverSizeClass = {
  compact: `${compactHeightClass} w-[min(21rem,calc(100vw-1.5rem))]`,
  expanded: 'h-[min(40rem,80vh)] w-[min(34rem,calc(100vw-1.5rem))]',
};

export const treeRowContainmentClass = '[content-visibility:auto] [contain-intrinsic-size:auto_1.75rem]';

/** The chat shell maps this onto `--chat-inset-end`, which pads its scroller. */
export const reservedSpaceClass = {
  none: '[--workspace-files-inset:0px]',
  docked: '[--workspace-files-inset:calc(var(--workspace-files-card)+var(--thread-gutter)+var(--thread-gutter))]',
};
