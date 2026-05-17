import type { Component } from '@mariozechner/pi-tui';
import { getChatSpacingKind, getSpacingBetween } from './chat-spacing.js';

export class ChatBoundarySpacer implements Component {
  readonly isChatBoundarySpacer = true;

  constructor(
    private readonly getPrev: () => Component | undefined,
    private readonly getNext: () => Component | undefined,
  ) {}

  invalidate(): void {}

  render(): string[] {
    const spacing = getSpacingBetween(getChatSpacingKind(this.getPrev()), getChatSpacingKind(this.getNext()));
    return Array.from({ length: spacing }, () => '');
  }
}

export function isChatBoundarySpacer(component: unknown): component is ChatBoundarySpacer {
  return !!component && (component as { isChatBoundarySpacer?: boolean }).isChatBoundarySpacer === true;
}
