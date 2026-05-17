import type { Component, Container } from '@mariozechner/pi-tui';
import { ChatBoundarySpacer, isChatBoundarySpacer } from './components/chat-boundary-spacer.js';

export function reconcileChatBoundarySpacers(chatContainer: Container): void {
  const components = (chatContainer.children as Component[]).filter(child => !isChatBoundarySpacer(child));
  const nextChildren: Component[] = [];

  for (let i = 0; i < components.length; i++) {
    const component = components[i]!;
    nextChildren.push(component);

    const next = components[i + 1];
    if (next) {
      nextChildren.push(new ChatBoundarySpacer(() => component, () => next));
    }
  }

  chatContainer.children = nextChildren as never[];
  chatContainer.invalidate();
}
