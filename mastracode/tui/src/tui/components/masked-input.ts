/**
 * MaskedInput - wraps pi-tui's Input to obscure displayed text with asterisks.
 * The actual value is preserved; only the rendered output is masked.
 */

import { Input } from '@earendil-works/pi-tui';
import type { Component, Focusable } from '@earendil-works/pi-tui';

export class MaskedInput implements Component, Focusable {
  private input: Input;
  private masked = true;

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

  /**
   * Toggle masking. The OAuth code prompt masks; non-secret prompts (the
   * post-login account-name prompt) must show the typed text.
   */
  setMasked(masked: boolean): void {
    this.masked = masked;
    this.input.invalidate();
  }

  handleInput(data: string): void {
    this.input.handleInput(data);
  }

  invalidate(): void {
    this.input.invalidate();
  }

  render(width: number): string[] {
    if (!this.masked) {
      return this.input.render(width);
    }
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
