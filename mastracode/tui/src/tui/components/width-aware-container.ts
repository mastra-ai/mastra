import { Container } from '@earendil-works/pi-tui';

/** Rebuilds width-derived children only when state or the received render width changes. */
export abstract class WidthAwareContainer extends Container {
  private builtWidth: number | undefined;

  protected get renderWidth(): number {
    return this.builtWidth!;
  }

  protected rebuild(): void {
    if (this.builtWidth !== undefined) {
      this.rebuildForWidth(this.builtWidth);
    }
  }

  protected abstract rebuildForWidth(width: number): void;

  override render(width: number): string[] {
    if (this.builtWidth !== width) {
      this.builtWidth = width;
      this.rebuildForWidth(width);
    }
    return super.render(width);
  }
}
