import type { MastraBrowser, MouseEventParams, KeyboardEventParams, ScreencastStream } from './browser';
import type { BrowserState } from './thread-manager';

/** User preferences for the existing browser, in CSS pixels. No navigation is implied. */
export interface BrowserViewerPreferences {
  width: number;
  height: number;
  deviceScaleFactor: number;
  locale: string;
}

export type BrowserViewerCommand =
  | { type: 'preferences'; preferences: BrowserViewerPreferences }
  | { type: 'navigate'; url: string }
  | { type: 'back' | 'forward' | 'reload' | 'new-tab' }
  | { type: 'switch-tab' | 'close-tab'; index: number }
  | { type: 'mouse'; event: MouseEventParams }
  | { type: 'keyboard'; event: KeyboardEventParams }
  | { type: 'text'; text: string };

export type BrowserViewerEvent =
  | { type: 'frame'; data: string; format: 'jpeg' | 'png'; viewport: { width: number; height: number } }
  | { type: 'state'; state: BrowserState | null; incarnation: string }
  | { type: 'error'; message: string }
  | { type: 'closed' };

/** One screencast per native browser/thread; consumers share it without owning the browser. */
export class BrowserViewer {
  private listeners = new Set<(event: BrowserViewerEvent) => void>();
  private stream?: ScreencastStream;
  private opening?: Promise<void>;
  private closing?: Promise<void>;
  private detachClosed?: () => void;
  private statePending = false;
  private stateDirty = false;
  private lastFrame?: BrowserViewerEvent;
  private commands: Promise<unknown> = Promise.resolve();
  private queuedCommands = 0;

  constructor(
    private browser: MastraBrowser,
    private threadId: string | undefined,
  ) {}

  private publish(event: BrowserViewerEvent) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        /* A disconnected consumer must not fail the browser. */
      }
    }
  }

  async refreshState() {
    if (this.statePending) {
      this.stateDirty = true;
      return;
    }
    this.statePending = true;
    try {
      do {
        this.stateDirty = false;
        const state = await this.browser.getBrowserState(this.threadId);
        this.publish({ type: 'state', state, incarnation: this.browser.getActivityState().incarnation });
      } while (this.stateDirty && this.listeners.size);
    } finally {
      this.statePending = false;
    }
  }

  async subscribe(listener: (event: BrowserViewerEvent) => void): Promise<() => Promise<void>> {
    await this.closing;
    this.listeners.add(listener);
    try {
      if (!this.stream && !this.opening) {
        this.opening = this.open().finally(() => {
          this.opening = undefined;
        });
      }
      await this.opening;
      if (this.lastFrame) listener(this.lastFrame);
      await this.refreshState();
    } catch (error) {
      this.listeners.delete(listener);
      if (!this.listeners.size) await this.stop();
      throw error;
    }
    let released = false;
    return async () => {
      if (released) return;
      released = true;
      this.listeners.delete(listener);
      if (!this.listeners.size) await this.stop();
    };
  }

  private async open() {
    const stream = await this.browser.startScreencastIfBrowserActive({ threadId: this.threadId });
    if (!stream) throw new Error('Browser is not running');
    this.stream = stream;
    stream.on('frame', frame => {
      this.lastFrame = {
        type: 'frame',
        ...frame,
        viewport: this.browser.getViewerViewport(this.threadId) ?? frame.viewport,
        format: this.browser.getScreencastFormat(),
      };
      this.publish(this.lastFrame);
    });
    stream.on('url', () => {
      void this.refreshState().catch(() => this.publish({ type: 'closed' }));
    });
    stream.on('stop', () =>
      this.publish(
        this.browser.isBrowserRunning(this.threadId)
          ? { type: 'error', message: 'Browser stream stopped' }
          : { type: 'closed' },
      ),
    );
    stream.on('error', () => {
      this.publish({ type: 'error', message: 'Browser stream failed' });
      void this.stop();
    });
    this.detachClosed = this.browser.onBrowserClosed(() => {
      this.publish({ type: 'closed' });
      void this.stop();
    }, this.threadId);
    // Providers start capturing before returning the stream. Request the initial
    // frame again now that listeners exist, including for a static blank page.
    await stream.reconnect();
  }

  private async stop() {
    if (this.closing) return this.closing;
    const stream = this.stream;
    this.stream = undefined;
    this.lastFrame = undefined;
    this.detachClosed?.();
    this.detachClosed = undefined;
    this.closing = Promise.resolve(stream?.stop()).finally(() => {
      this.closing = undefined;
    });
    return this.closing;
  }

  /** Serialize input and validate launch identity again when it reaches the browser. */
  command(command: BrowserViewerCommand, incarnation: string) {
    if (this.queuedCommands >= 128) return Promise.reject(new Error('Browser input queue is full'));
    this.queuedCommands += 1;
    const work = this.commands
      .then(async () => {
        if (
          !this.browser.isBrowserRunning(this.threadId) ||
          this.browser.getActivityState().incarnation !== incarnation
        ) {
          throw new Error('Browser connection changed');
        }
        await this.browser.executeViewerCommand(command, this.threadId);
        if (command.type !== 'mouse' && command.type !== 'keyboard' && command.type !== 'text')
          await this.refreshState();
      })
      .finally(() => {
        this.queuedCommands -= 1;
      });
    this.commands = work.catch(() => {});
    return work;
  }
}
