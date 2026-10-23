/** Named duration rungs, one per `@utility duration-*` in `theme/motion.css`. Tailwind cannot
 * infer a custom utility, so `lib/tw-merge-config.ts` registers these names to keep
 * `duration-fast` and `duration-slow` from both surviving a merge. */
export const Durations = ['fast', 'normal', 'slow'] as const;

/** Entrance played by anything the reader watches arrive. Defined in `ds/components/Arrival/arrival.css`. */
export const ARRIVING_CLASS = 'mastra-arriving';

/** How long that entrance runs, and so how long a word counts as new. Kept in step with `arrival.css`. */
export const ARRIVING_MS = 800;
