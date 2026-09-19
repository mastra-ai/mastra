import { randomUUID } from 'node:crypto';
import type { BrowserContext, CDPSession, Frame, Page } from 'playwright-core';

/**
 * Observes trusted input in a private Chrome execution world. Page scripts cannot
 * invoke the binding or manufacture trusted input. No keys or page contents leave Chrome.
 * @khayalek-known-mastra-violation KV-BR-001
 */
export class BrowserActivityObserver {
  private readonly world = `mastra-activity-${randomUUID()}`;
  private readonly binding = '__mastraBrowserActivity';
  private readonly sessions = new Set<CDPSession>();
  private readonly pages = new Map<Page, Promise<void>>();
  private readonly frameHandlers = new Map<Page, (frame: Frame) => void>();
  private readonly frames = new Map<Frame, Promise<void>>();
  private readonly frameSessions = new Map<Frame, CDPSession>();
  private stopped = false;
  private readonly onPage = (page: Page) => {
    void this.observe(page).catch(error => {
      if (!this.stopped && !page.isClosed()) this.onError(error);
    });
  };

  constructor(
    private readonly context: BrowserContext,
    private readonly onActivity: () => void,
    private readonly onError: (error: unknown) => void,
  ) {}

  async start(): Promise<void> {
    this.context.on('page', this.onPage);
    try {
      await Promise.all(this.context.pages().map(page => this.observe(page)));
    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  private observe(page: Page): Promise<void> {
    const existing = this.pages.get(page);
    if (existing) return existing;
    const onFrame = (frame: Frame) => {
      if (!frame.parentFrame()) return;
      const pending = this.context
        .newCDPSession(frame)
        .then(async session => {
          if (this.frames.get(frame) !== pending || this.stopped) {
            await session.detach();
            return;
          }
          await this.attachSession(session, page, () => this.frames.get(frame) === pending && !frame.isDetached());
          const previous = this.frameSessions.get(frame);
          this.frameSessions.set(frame, session);
          if (previous) {
            await previous.detach().catch(() => undefined);
            this.sessions.delete(previous);
          }
        })
        .catch(error => {
          if (this.frames.get(frame) !== pending) return;
          this.frames.delete(frame);
          // Same-process frames are covered by the page session's new-document script.
          if (String(error).includes('does not have a separate CDP session')) return;
          if (!this.stopped && !page.isClosed() && !frame.isDetached()) this.onError(error);
        });
      this.frames.set(frame, pending);
    };
    this.frameHandlers.set(page, onFrame);
    page.on('framenavigated', onFrame);
    for (const frame of page.frames()) onFrame(frame);
    const pending = this.attach(page);
    this.pages.set(page, pending);
    return pending;
  }

  private async attach(page: Page): Promise<void> {
    const session = await this.context.newCDPSession(page);
    await this.attachSession(session, page);
  }

  private async attachSession(session: CDPSession, page: Page, current = () => true): Promise<void> {
    this.sessions.add(session);
    if (this.stopped) {
      await session.detach();
      return;
    }
    const contexts = new Set<number>();
    session.on('Runtime.executionContextCreated', ({ context }) => {
      if (context.name === this.world && context.auxData?.type === 'isolated') contexts.add(context.id);
    });
    session.on('Runtime.executionContextDestroyed', ({ executionContextId }) => contexts.delete(executionContextId));
    session.on('Runtime.executionContextsCleared', () => contexts.clear());
    session.on('Runtime.bindingCalled', event => {
      if (
        !this.stopped &&
        event.name === this.binding &&
        event.payload === 'input' &&
        contexts.has(event.executionContextId)
      ) {
        this.onActivity();
      }
    });
    const expression = `(() => {
      const previous = globalThis.__mastraActivityListener;
      const listener = event => {
        if (event.isTrusted) globalThis.${this.binding}('input');
      };
      globalThis.__mastraActivityListener = listener;
      for (const type of ['pointerdown', 'keydown', 'wheel', 'touchstart']) {
        if (previous) globalThis.removeEventListener(type, previous, true);
        globalThis.addEventListener(type, listener, { capture: true, passive: true });
      }
    })()`;
    await session.send('Runtime.enable');
    await session.send('Page.enable');
    await session.send('Runtime.addBinding', { name: this.binding, executionContextName: this.world });
    await session.send('Page.addScriptToEvaluateOnNewDocument', { source: expression, worldName: this.world });
    const install = async (tree: { frame: { id: string }; childFrames?: (typeof tree)[] }): Promise<void> => {
      const { executionContextId } = await session.send('Page.createIsolatedWorld', {
        frameId: tree.frame.id,
        worldName: this.world,
      });
      const result = await session.send('Runtime.evaluate', { expression, contextId: executionContextId });
      if (result.exceptionDetails) throw new Error('Browser activity observation could not be installed');
      await Promise.all((tree.childFrames ?? []).map(install));
    };
    const refresh = async () => {
      const { frameTree } = await session.send('Page.getFrameTree');
      await install(frameTree);
    };
    session.on('DOM.documentUpdated', () => {
      void refresh().catch(error => {
        if (!this.stopped && !page.isClosed() && current()) this.onError(error);
      });
    });
    await session.send('DOM.enable');
    await refresh();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.context.off('page', this.onPage);
    for (const [page, handler] of this.frameHandlers) page.off('framenavigated', handler);
    this.frameHandlers.clear();
    await Promise.allSettled([...this.frames.values()]);
    await Promise.allSettled([...this.pages.values()]);
    await Promise.allSettled([...this.sessions].map(session => session.detach()));
    this.pages.clear();
    this.frames.clear();
    this.frameSessions.clear();
    this.sessions.clear();
  }
}
