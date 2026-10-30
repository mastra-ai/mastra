/**
 * Coalesces a burst of change notices into refetches. Each notice pushes the trailing refetch back by
 * `debounceMs`, so a page and its notes refetch once; but the first notice of a burst also sets a
 * deadline `maxWaitMs` out, so a steady write stream (an import writing hundreds of pages) still
 * refreshes the view as it goes instead of freezing until the writes stop.
 */
export function createBurstRefresh(run: () => void, debounceMs: number, maxWaitMs: number) {
  let trailing: ReturnType<typeof setTimeout> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => {
    clearTimeout(trailing);
    clearTimeout(deadline);
    trailing = undefined;
    deadline = undefined;
  };
  const fire = () => {
    cancel();
    run();
  };
  return {
    notify() {
      clearTimeout(trailing);
      trailing = setTimeout(fire, debounceMs);
      deadline ??= setTimeout(fire, maxWaitMs);
    },
    cancel,
  };
}
