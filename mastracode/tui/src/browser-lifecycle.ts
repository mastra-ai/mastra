import type { MastraBrowser } from '@mastra/core/browser';

/**
 * The browser Mastra Code's agents currently use. Mastra Code owns it: a local
 * browser keeps running (and holds its profile's lock) until it is closed, so
 * it must be closed when replaced and when Mastra Code exits.
 */
let activeBrowser: MastraBrowser | undefined;

const CLOSE_TIMEOUT_MS = 5_000;

/**
 * Retire a browser: it closes and never relaunches, even for a tool call that
 * still holds it. If close fails or takes longer than CLOSE_TIMEOUT_MS, its
 * processes are killed so the old Chrome cannot keep holding the profile.
 */
async function closeBrowser(browser: MastraBrowser): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const closed = await Promise.race([
    browser.retire().then(
      () => true,
      () => false,
    ),
    new Promise<false>(resolve => {
      timer = setTimeout(() => resolve(false), CLOSE_TIMEOUT_MS);
      timer.unref?.();
    }),
  ]);
  clearTimeout(timer);
  if (!closed) {
    browser.killProcesses();
  }
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
 * Every close still in flight, chained so a later replacement (or exit) waits
 * for all of them, not just the browser it replaced. Each browser is retired once.
 */
let retiring: Promise<void> = Promise.resolve();
let retiringBrowser: MastraBrowser | undefined;

/**
 * Make `next` the active browser, closing the previous one first so it
 * releases its profile before `next` launches on it. Also waits for any
 * browser an earlier replacement is still closing.
 *
 * Returns whether `next` is still the active browser once those closes finish.
 * False means a later call replaced (and closed) it meanwhile, so the caller
 * must not hand `next` to agents.
 */
export async function replaceActiveBrowser(next: MastraBrowser | undefined): Promise<boolean> {
  const previous = activeBrowser;
  activeBrowser = next;
  const mine = ++generation;
  if (previous && previous !== next && previous !== retiringBrowser) {
    retiringBrowser = previous;
    retiring = Promise.all([retiring, closeBrowser(previous)]).then(() => {});
  }
  await retiring;
  return generation === mine;
}

/** Close the active browser. Bounded so a hung browser cannot block exit. */
export async function closeActiveBrowser(): Promise<void> {
  await replaceActiveBrowser(undefined);
}
