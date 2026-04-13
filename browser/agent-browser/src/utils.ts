import type { BrowserManager } from 'agent-browser';

/**
 * Get the browser process PID from a BrowserManager instance via CDP.
 *
 * Playwright doesn't expose the browser process PID directly, so we use CDP's
 * SystemInfo.getProcessInfo to get it. This works for both regular browser
 * launches and persistent contexts (profiles).
 *
 * Returns undefined if the PID can't be retrieved (e.g., browser not running).
 */
export async function getBrowserPid(manager: BrowserManager): Promise<number | undefined> {
  try {
    // Try getBrowser() first, fall back to context.browser() for persistent contexts
    let browser = manager.getBrowser();
    if (!browser) {
      const ctx = manager.getContext();
      browser = ctx?.browser?.() ?? null;
    }
    if (!browser) return undefined;

    const cdp = await browser.newBrowserCDPSession();
    try {
      const info = await cdp.send('SystemInfo.getProcessInfo');
      const browserProcess = info.processInfo?.find((p: { type: string }) => p.type === 'browser');
      return browserProcess?.id;
    } finally {
      await cdp.detach().catch(() => undefined);
    }
  } catch {
    return undefined;
  }
}
