export const DEFAULT_RENDER_COALESCE_MS = 80;

export class RenderScheduler {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private lastRenderAt = 0;
  private pending = false;

  constructor(
    private readonly render: () => void,
    private readonly intervalMs = DEFAULT_RENDER_COALESCE_MS,
    private readonly now = () => Date.now(),
  ) {}

  request(): void {
    if (this.pending) return;

    const elapsed = this.now() - this.lastRenderAt;
    if (elapsed >= this.intervalMs) {
      this.run();
      return;
    }

    this.pending = true;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.run();
    }, this.intervalMs - elapsed);
  }

  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.pending = false;
    this.run();
  }

  dispose(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.pending = false;
  }

  private run(): void {
    this.pending = false;
    this.lastRenderAt = this.now();
    this.render();
  }
}

export interface RenderableState {
  ui: { requestRender?: () => void };
  renderScheduler?: RenderScheduler;
}

export function requestRender(state: RenderableState): void {
  state.renderScheduler?.request() ?? state.ui.requestRender?.();
}

export function flushRender(state: RenderableState): void {
  state.renderScheduler?.flush() ?? state.ui.requestRender?.();
}
