import type { Component, OverlayHandle, OverlayOptions, SizeValue, TUI } from '@earendil-works/pi-tui';
import { visibleWidth } from '@earendil-works/pi-tui';

import { MenuFrame } from './prompt-slot.js';
import type { MastraTUI, PromptSlotChrome } from './prompt-slot.js';
import { theme } from './theme.js';

type ModalOverlayOptions = PromptSlotChrome & {
  /** Covers the whole terminal (setup): shown as a pop-up as is, never in the prompt slot. */
  fullscreen?: boolean;
  widthPercent?: number;
  maxWidth?: number;
  maxHeight?: OverlayOptions['maxHeight'];
  minHeightPercent?: number;
  maxTopPadding?: number;
};

function parseSizeValue(value: SizeValue | undefined, total: number): number | undefined {
  if (typeof value === 'number') return value;
  const match = value?.match(/^(\d+(?:\.\d+)?)%$/);
  return match?.[1] ? Math.floor((parseFloat(match[1]) / 100) * total) : undefined;
}

function modalMinHeight(tui: TUI, options: ModalOverlayOptions): number {
  const termHeight = tui.terminal?.rows ?? 40;
  const minHeight = Math.floor(termHeight * (options.minHeightPercent ?? 0.7));
  const maxHeight = parseSizeValue(options.maxHeight ?? '80%', termHeight) ?? termHeight;

  return Math.max(1, Math.min(minHeight, maxHeight));
}

class MinHeightOverlay implements Component {
  constructor(
    private component: Component,
    private tui: TUI,
    private options: ModalOverlayOptions,
  ) {}

  get focused(): boolean {
    return (this.component as Component & { focused?: boolean }).focused ?? false;
  }

  set focused(value: boolean) {
    if ('focused' in this.component) {
      (this.component as Component & { focused: boolean }).focused = value;
    }
  }

  get wantsKeyRelease(): boolean | undefined {
    return this.component.wantsKeyRelease;
  }

  handleInput(data: string): void {
    this.component.handleInput?.(data);
  }

  invalidate(): void {
    this.component.invalidate?.();
  }

  render(width: number): string[] {
    const lines = this.component.render(width);
    const minHeight = modalMinHeight(this.tui, this.options);
    if (lines.length >= minHeight) return lines;

    const blank = theme.bg('overlayBg', ' '.repeat(width));
    const missingLines = minHeight - lines.length;
    const topPadding = Math.min(Math.floor(missingLines / 2), this.options.maxTopPadding ?? 4);
    const padded = [
      ...Array.from({ length: topPadding }, () => blank),
      ...lines,
      ...Array.from({ length: missingLines - topPadding }, () => blank),
    ];

    return padded.map(line => {
      const padNeeded = Math.max(0, width - visibleWidth(line));
      return padNeeded > 0 ? `${line}${theme.bg('overlayBg', ' '.repeat(padNeeded))}` : line;
    });
  }
}

export function modalOverlayOptions(tui: TUI, options: ModalOverlayOptions = {}): OverlayOptions {
  const widthPercent = options.widthPercent ?? 0.9;
  const maxWidth = options.maxWidth ?? 160;
  const termWidth = tui.terminal?.columns ?? 120;

  const width = Math.max(1, Math.min(Math.floor(termWidth * widthPercent), maxWidth));

  return {
    width,
    minWidth: Math.min(width, 90),
    maxHeight: options.maxHeight ?? '80%',
  };
}

/**
 * Opens a menu or dialog. In the app it opens in the prompt slot (in place of the prompt, see
 * prompt-slot.ts) with `title` as its search placeholder. While a pop-up such as the full-screen setup
 * is open, or in a TUI without a slot, it opens as a pop-up on top instead, framed the same way.
 */
export function showModalOverlay(tui: TUI, component: Component, options: ModalOverlayOptions = {}): OverlayHandle {
  const chrome = { title: options.title, hints: options.hints };
  if (options.fullscreen) {
    return tui.showOverlay(new MinHeightOverlay(component, tui, options), modalOverlayOptions(tui, options));
  }
  const app = tui as Partial<MastraTUI>;
  if (app.promptSlot && !app.hasPopup?.()) return app.promptSlot.open(component, chrome);
  return tui.showOverlay(
    new MinHeightOverlay(new MenuFrame(component, chrome), tui, options),
    modalOverlayOptions(tui, options),
  );
}
