import { useDebounce } from 'use-debounce';

export const STREAM_IDLE_DEBOUNCE_MS = 3000;

/**
 * Defers only the true -> false transition of `isRunning` by
 * {@link STREAM_IDLE_DEBOUNCE_MS}: the flag flips to true immediately, while
 * going idle waits for the debounced value to settle. The stream flag can
 * briefly drop to false mid-conversation (e.g. between builder runs);
 * consumers gating layout or controls on "the builder is busy" use this to
 * avoid flickering.
 */
export const useDebouncedRunning = (isRunning: boolean): boolean => {
  const [debouncedIsRunning] = useDebounce(isRunning, STREAM_IDLE_DEBOUNCE_MS);
  return isRunning || debouncedIsRunning;
};
