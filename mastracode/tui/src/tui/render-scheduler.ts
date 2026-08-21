export const DEFAULT_RENDER_COALESCE_MS = 150;

export class RenderScheduler {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private lastRenderAt = 0;
  private pending = false;
  private forcePending = false;
  private rendering = false;
  private disposed = false;

  constructor(
    private readonly render: (force?: boolean) => void,
    private readonly intervalMs = DEFAULT_RENDER_COALESCE_MS,
    private readonly now = () => Date.now(),
    private readonly beforeRender?: () => void,
    private readonly onDispose?: () => void,
  ) {}

  request(force = false): void {
    if (this.disposed) return;
    if (force) {
      this.flush(true);
      return;
    }
    if (this.pending) return;

    const elapsed = this.now() - this.lastRenderAt;
    const delay = Math.max(0, this.intervalMs - elapsed);
    this.pending = true;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.run();
    }, delay);
  }

  flush(force = false): void {
    if (this.disposed) return;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.pending = false;
    this.forcePending ||= force;
    if (this.rendering) {
      this.pending = true;
      return;
    }
    this.run();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.pending = false;
    this.forcePending = false;
    this.onDispose?.();
  }

  private run(): void {
    this.pending = false;
    if (this.disposed) return;
    const force = this.forcePending;
    this.forcePending = false;
    this.lastRenderAt = this.now();
    this.rendering = true;
    try {
      this.beforeRender?.();
      this.render(force);
    } finally {
      this.rendering = false;
      if (this.forcePending || (this.pending && !this.timer)) {
        this.pending = false;
        queueMicrotask(() => this.flush());
      }
    }
  }
}

interface SchedulableUI {
  requestRender(force?: boolean): void;
  addInputListener?(listener: (data: string) => { consume?: boolean; data?: string } | undefined): () => void;
}

export function installRenderScheduler(
  ui: SchedulableUI,
  beforeRender?: () => void,
  intervalMs?: number,
  now?: () => number,
): RenderScheduler {
  const originalRequestRender = ui.requestRender;
  const render = originalRequestRender.bind(ui);
  let removeInputListener: (() => void) | undefined;
  let scheduledRequestRender!: SchedulableUI['requestRender'];
  const scheduler = new RenderScheduler(render, intervalMs, now, beforeRender, () => {
    removeInputListener?.();
    if (ui.requestRender === scheduledRequestRender) ui.requestRender = originalRequestRender;
  });
  let handlingInput = false;
  let renderedForInput = false;

  removeInputListener = ui.addInputListener?.(() => {
    handlingInput = true;
    renderedForInput = false;
    queueMicrotask(() => {
      handlingInput = false;
      renderedForInput = false;
    });
    return undefined;
  });
  scheduledRequestRender = force => {
    if (force) {
      scheduler.request(true);
      return;
    }
    if (handlingInput) {
      if (!renderedForInput) {
        renderedForInput = true;
        scheduler.flush();
      }
      return;
    }
    scheduler.request();
  };
  ui.requestRender = scheduledRequestRender;
  return scheduler;
}

export interface RenderableState {
  ui: { requestRender?: (force?: boolean) => void };
  renderScheduler?: RenderScheduler;
  assistantRenderRegistry?: { applyPending: () => unknown };
}

export function requestRender(state: RenderableState): void {
  if (state.renderScheduler) {
    state.renderScheduler.request();
    return;
  }
  state.assistantRenderRegistry?.applyPending();
  state.ui.requestRender?.();
}

export function flushRender(state: RenderableState): void {
  if (state.renderScheduler) {
    state.renderScheduler.flush();
    return;
  }
  state.assistantRenderRegistry?.applyPending();
  state.ui.requestRender?.();
}
