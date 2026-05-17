import type { Component, Container } from '@mariozechner/pi-tui';
import { ChatBoundarySpacer, isChatBoundarySpacer } from './components/chat-boundary-spacer.js';
import { getChatSpacingKind } from './components/chat-spacing.js';

interface CompactToolGroupingParticipant {
  getCompactToolGroupKey?(): string | undefined;
  getCompactToolGroupSummary?(): string | undefined;
  setCompactToolContinuation?(continuation: boolean, previousSummary?: string): void;
}

export function insertChatComponentWithBoundarySpacing(
  chatContainer: Container,
  child: Component,
  index = chatContainer.children.length,
): void {
  const children = chatContainer.children as Component[];
  const boundedIndex = Math.max(0, Math.min(index, children.length));
  const previous = findPreviousSpacingComponent(children, boundedIndex);
  const next = findNextSpacingComponent(children, boundedIndex);
  const inserted: Component[] = [];

  if (previous) {
    inserted.push(new ChatBoundarySpacer(() => previous, () => child));
  }
  inserted.push(child);
  if (next) {
    inserted.push(new ChatBoundarySpacer(() => child, () => next));
  }

  children.splice(boundedIndex, 0, ...inserted);
  reconcileChatBoundarySpacers(chatContainer);
}

function findPreviousSpacingComponent(children: Component[], index: number): Component | undefined {
  for (let i = index - 1; i >= 0; i--) {
    const child = children[i];
    if (child && !isChatBoundarySpacer(child) && getChatSpacingKind(child)) return child;
  }
  return undefined;
}

function findNextSpacingComponent(children: Component[], index: number): Component | undefined {
  for (let i = index; i < children.length; i++) {
    const child = children[i];
    if (child && !isChatBoundarySpacer(child) && getChatSpacingKind(child)) return child;
  }
  return undefined;
}

function findNextSpacingComponentInList(components: Component[], index: number): Component | undefined {
  for (let i = index + 1; i < components.length; i++) {
    const child = components[i];
    if (child && getChatSpacingKind(child)) return child;
  }
  return undefined;
}

export function reconcileChatBoundarySpacers(chatContainer: Container): void {
  const components = (chatContainer.children as Component[]).filter(child => !isChatBoundarySpacer(child));
  const nextChildren: Component[] = [];
  let previousCompactToolGroupKey: string | undefined;
  let previousCompactToolSummary: string | undefined;

  for (let i = 0; i < components.length; i++) {
    const component = components[i]!;
    const participant = component as CompactToolGroupingParticipant;
    const compactToolGroupKey = participant.getCompactToolGroupKey?.();
    const compactToolGroupSummary = participant.getCompactToolGroupSummary?.();
    const isContinuation = !!compactToolGroupKey && compactToolGroupKey === previousCompactToolGroupKey;
    participant.setCompactToolContinuation?.(isContinuation, isContinuation ? previousCompactToolSummary : undefined);
    if (getChatSpacingKind(component)) {
      previousCompactToolGroupKey = compactToolGroupKey;
      previousCompactToolSummary = compactToolGroupSummary;
    }

    nextChildren.push(component);

    if (getChatSpacingKind(component)) {
      const next = findNextSpacingComponentInList(components, i);
      if (next) {
        nextChildren.push(new ChatBoundarySpacer(() => component, () => next));
      }
    }
  }

  chatContainer.children = nextChildren as never[];
  chatContainer.invalidate();
}
