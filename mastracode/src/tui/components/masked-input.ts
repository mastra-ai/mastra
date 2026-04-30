/**
 * MaskedInput - wraps pi-tui's Input to obscure displayed text with asterisks.
 * The actual value is preserved; only the rendered output is masked.
 */

import { Input } from '@mariozechner/pi-tui';
import type { Component, Focusable } from '@mariozechner/pi-tui';

export class MaskedInput implements Component, Focusable {
  private input: Input;

  get focused(): boolean {
    return this.input.focused;
  }
  set focused(value: boolean) {
    this.input.focused = value;
  }

  set onSubmit(fn: ((value: string) => void) | undefined) {
    this.input.onSubmit = fn;
  }

  set onEscape(fn: (() => void) | undefined) {
    this.input.onEscape = fn;
  }

  constructor() {
    this.input = new Input();
  }

  getValue(): string {
    return this.input.getValue();
  }

  setValue(value: string): void {
    this.input.setValue(value);
  }

  handleInput(data: string): void {
    this.input.handleInput(data);
  }

  invalidate(): void {
    this.input.invalidate();
  }

  render(width: number): string[] {
    // Temporarily swap the value to masked characters, render, then restore.
    const real = this.input.getValue();
    try {
      this.input.setValue('*'.repeat(real.length));
      return this.input.render(width);
    } finally {
      this.input.setValue(real);
    }
  }
}
