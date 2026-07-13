export const DEFAULT_RENDER_COALESCE_MS = 80;

export class RenderScheduler {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private lastRenderAt = 0;
  private pending = false;
  private disposed = false;

  constructor(
    private readonly render: () => void,
    private readonly intervalMs = DEFAULT_RENDER_COALESCE_MS,
    private readonly now = () => Date.now(),
  ) {}

  request(): void {
    if (this.disposed || this.pending) return;

    const elapsed = this.now() - this.lastRenderAt;
    const delay = Math.max(0, this.intervalMs - elapsed);
    this.pending = true;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.run();
    }, delay);
  }

  flush(): void {
    if (this.disposed) return;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.pending = false;
    this.run();
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.pending = false;
  }

  private run(): void {
    this.pending = false;
    if (this.disposed) return;
    this.lastRenderAt = this.now();
    this.render();
  }
}

export interface RenderableState {
  ui: { requestRender?: () => void };
  renderScheduler?: RenderScheduler;
}

export function requestRender(state: RenderableState): void {
  if (state.renderScheduler) {
    state.renderScheduler.request();
    return;
  }
  state.ui.requestRender?.();
}

export function flushRender(state: RenderableState): void {
  if (state.renderScheduler) {
    state.renderScheduler.flush();
    return;
  }
  state.ui.requestRender?.();
}
