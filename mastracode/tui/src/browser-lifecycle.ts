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
 * Make `next` the active browser, closing the previous one first so it
 * releases its profile before `next` launches on it.
 */
export async function replaceActiveBrowser(next: MastraBrowser | undefined): Promise<void> {
  const previous = activeBrowser;
  activeBrowser = next;
  if (previous && previous !== next) {
    await closeBrowser(previous);
  }
}

/** Close the active browser. Bounded so a hung browser cannot block exit. */
export async function closeActiveBrowser(): Promise<void> {
  await replaceActiveBrowser(undefined);
}
