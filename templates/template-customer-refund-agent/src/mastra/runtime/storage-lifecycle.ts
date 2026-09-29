/**
 * Mastra owns initialization of its composite storage. App-owned tables share
 * the local file, so their first migration waits for that canonical async init
 * rather than racing Mastra's per-domain DDL.
 */
let mastraStorageReady: Promise<void> = Promise.resolve();

export function setMastraStorageReady(ready: Promise<void>) {
  mastraStorageReady = ready;
}

export function waitForMastraStorage() {
  return mastraStorageReady;
}

/** Attach one observed continuation so storage startup failures are logged and
 * never become an unhandled rejection before local workers can start. */
export function startAfterStorageReady<T>(
  ready: Promise<void>,
  start: () => T | Promise<T>,
  onFailure: (error: unknown) => void,
) {
  const lifecycle = ready.then(start);
  void lifecycle.catch(onFailure);
  return lifecycle;
}
