import type { SandboxComputer } from '@mastra/core/workspace';

import type { PlatformComputer, PlatformComputerDeps } from './computer.js';

/** The noVNC viewer's port in the desktop image. */
export const COMPUTER_VIEWER_PORT = 6080;

/** The first `@mastra/core` with the computer accessibility part the desktop needs. */
export const COMPUTER_MIN_CORE_VERSION = '1.86.0';

async function loadComputerModule(): Promise<typeof import('./computer.js')> {
  // Checked before loading: a CommonJS build would load the computer with the missing export as `undefined`.
  const core: Record<string, unknown> = await import('@mastra/core/workspace');
  if (!('AccessibilityRefError' in core)) {
    throw new Error(
      `PlatformSandbox computer needs @mastra/core ${COMPUTER_MIN_CORE_VERSION} or later; the installed @mastra/core has no computer accessibility part. Upgrade @mastra/core.`,
    );
  }
  return import('./computer.js');
}

/**
 * The desktop computer, loaded on its first call. Only a sandbox with the
 * computer enabled builds this, so without `MASTRA_EXPERIMENTAL_COMPUTER`
 * the computer module (and the `@mastra/core` values it needs) never loads.
 */
export function createLazyPlatformComputer(
  deps: PlatformComputerDeps,
  onLoad: (computer: PlatformComputer) => void,
): SandboxComputer {
  let loading: Promise<PlatformComputer> | undefined;
  const use = <T>(fn: (computer: PlatformComputer) => Promise<T>): Promise<T> => {
    if (!loading) {
      const attempt = loadComputerModule().then(({ createPlatformComputer }) => {
        const computer = createPlatformComputer(deps);
        onLoad(computer);
        return computer;
      });
      loading = attempt;
      // A failed load is retried on the next call.
      attempt.catch(() => {
        if (loading === attempt) loading = undefined;
      });
    }
    return loading.then(fn);
  };
  return {
    screenshot: () => use(c => c.screenshot()),
    leftClick: (x, y) => use(c => c.leftClick(x, y)),
    rightClick: (x, y) => use(c => c.rightClick(x, y)),
    doubleClick: (x, y) => use(c => c.doubleClick(x, y)),
    moveMouse: (x, y) => use(c => c.moveMouse(x, y)),
    drag: (from, to) => use(c => c.drag(from, to)),
    scroll: (direction, amount) => use(c => c.scroll(direction, amount)),
    type: text => use(c => c.type(text)),
    press: key => use(c => c.press(key)),
    getScreenSize: () => use(c => c.getScreenSize()),
    getCursorPosition: () => use(c => c.getCursorPosition()),
    streamUrl: () => use(c => c.streamUrl!()),
    accessibility: {
      getTree: options => use(c => c.accessibility!.getTree(options)),
      act: (ref, action) => use(c => c.accessibility!.act(ref, action)),
      setText: (ref, text) => use(c => c.accessibility!.setText(ref, text)),
    },
  };
}
