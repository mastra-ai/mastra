import type { Component } from '@mariozechner/pi-tui';
import { getSpacingBetweenComponents } from './chat-spacing.js';

export class ChatBoundarySpacer implements Component {
  readonly isChatBoundarySpacer = true;

  constructor(
    private readonly getPrev: () => Component | undefined,
    private readonly getNext: () => Component | undefined,
    private readonly getPrevPrev: () => Component | undefined = () => undefined,
    private readonly getNextNext: () => Component | undefined = () => undefined,
  ) {}

  invalidate(): void {}

  render(): string[] {
    const spacing = getSpacingBetweenComponents(this.getPrev(), this.getNext(), this.getPrevPrev(), this.getNextNext());
    return Array.from({ length: spacing }, () => '');
  }
}

export function isChatBoundarySpacer(component: unknown): component is ChatBoundarySpacer {
  return !!component && (component as { isChatBoundarySpacer?: boolean }).isChatBoundarySpacer === true;
}
