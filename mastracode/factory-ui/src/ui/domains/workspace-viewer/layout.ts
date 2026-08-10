// Docks only where chat column + card + gutters all fit, so revealing it never narrows the chat.
const CHAT_COLUMN_REM = 44;
const CARD_REM = 21;
const GUTTER_REM = 1.5;
const RAIL_LANE_REM = 7;

export const DOCK_MIN_REM = CHAT_COLUMN_REM + CARD_REM + GUTTER_REM * 2;

// Measured on the padded scroller, not the shell: the docked card's inset is room the rail
// cannot use, and below this the ticks land on the messages.
export const RAIL_MIN_REM = CHAT_COLUMN_REM + RAIL_LANE_REM * 2;

// Tailwind scans literals, so the rem values below can't interpolate the constants — keep in sync.
export const chatColumnClass = '[--chat-column:44rem]';

// Viewing grows into leftover room only (47rem = column + gutters) — never flips the dock decision.
export const cardWidthClass = {
  browsing: '[--workspace-files-card:21rem]',
  viewing: '[--workspace-files-card:min(34rem,calc(100%-47rem))]',
};

/** The chat shell maps this onto `--chat-inset-end`, which pads its scroller. */
export const reservedSpaceClass = {
  none: '[--workspace-files-inset:0px]',
  docked: '[--workspace-files-inset:calc(var(--workspace-files-card)+3rem)]',
};
