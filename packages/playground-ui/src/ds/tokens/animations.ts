/** Named durations, one per rung in `theme.css`. Keys are the utility suffix (`duration-fast`). */
export const Durations = {
  fast: '150ms',
  normal: '200ms',
  slow: '300ms',
};

export const Easings = {
  outCustom: 'cubic-bezier(0.33, 1, 0.68, 1)',
};

/** Entrance played by anything the reader watches arrive. Defined in `ds/components/Arrival/arrival.css`. */
export const ARRIVING_CLASS = 'mastra-arriving';

/** How long that entrance runs, and so how long a word counts as new. Kept in step with `arrival.css`. */
export const ARRIVING_MS = 800;
