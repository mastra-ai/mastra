import type { MastraBrowser } from '@mastra/core/browser';

/**
 * The browser Mastra Code's agents currently use. Mastra Code owns it: a local
 * browser keeps running (and holds its profile's lock) until it is closed, so
 * it must be closed when replaced and when Mastra Code exits.
 */
let activeBrowser: MastraBrowser | undefined;

const CLOSE_TIMEOUT_MS = 5_000;

async function closeBrowser(browser: MastraBrowser): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    browser.close().catch(() => {}),
    new Promise<void>(resolve => {
      timer = setTimeout(resolve, CLOSE_TIMEOUT_MS);
      timer.unref?.();
    }),
  ]);
  clearTimeout(timer);
}

/**
 * Counts replacements, so a caller that started creating a browser can tell
 * whether another caller replaced the active browser in the meantime.
 */
let generation = 0;

export function activeBrowserGeneration(): number {
  return generation;
}

/** Close a browser that never became active. Bounded like any other close. */
export function discardBrowser(browser: MastraBrowser): Promise<void> {
  return closeBrowser(browser);
}

/**
 * Make `next` the active browser, closing the previous one first so it
 * releases its profile before `next` launches on it.
 *
 * Returns whether `next` is still the active browser once the previous one is
 * closed. False means a later call replaced (and closed) it meanwhile, so the
 * caller must not hand `next` to agents.
 */
export async function replaceActiveBrowser(next: MastraBrowser | undefined): Promise<boolean> {
  const previous = activeBrowser;
  activeBrowser = next;
  const mine = ++generation;
  if (previous && previous !== next) {
    await closeBrowser(previous);
  }
  return generation === mine;
}

/** Close the active browser. Bounded so a hung browser cannot block exit. */
export async function closeActiveBrowser(): Promise<void> {
  await replaceActiveBrowser(undefined);
}
