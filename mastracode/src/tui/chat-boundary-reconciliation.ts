import type { Component, Container } from '@mariozechner/pi-tui';
import { ChatBoundarySpacer, isChatBoundarySpacer } from './components/chat-boundary-spacer.js';
import { getChatSpacingKind } from './components/chat-spacing.js';
import type { CompactToolLabelColor } from './components/tool-execution-interface.js';

interface CompactToolGroupingParticipant {
  getCompactToolGroupKey?(): string | undefined;
  getCompactToolGroupSummary?(): string | undefined;
  getOwnCompactToolLabelColor?(): CompactToolLabelColor | undefined;
  setCompactToolGroupLabelColor?(color: CompactToolLabelColor | undefined): void;
  setCompactToolContinuation?(continuation: boolean, previousSummary?: string): void;
  setCompactToolHasFollowingContinuation?(hasFollowingContinuation: boolean): void;
}

export function insertChatComponentWithBoundarySpacing(
  chatContainer: Container,
  child: Component,
  index = chatContainer.children.length,
): void {
  const children = chatContainer.children as Component[];
  const boundedIndex = Math.max(0, Math.min(index, children.length));
  const previous = findPreviousSpacingComponent(children, boundedIndex);
  const previousPrevious = findPreviousSpacingComponent(children, previous ? children.indexOf(previous) : -1);
  const next = findNextSpacingComponent(children, boundedIndex);
  const nextNext = findNextSpacingComponent(children, next ? children.indexOf(next) + 1 : children.length);
  const inserted: Component[] = [];

  if (previous) {
    inserted.push(
      new ChatBoundarySpacer(
        () => previous,
        () => child,
        () => previousPrevious,
        () => next,
      ),
    );
  }
  inserted.push(child);
  if (next) {
    inserted.push(
      new ChatBoundarySpacer(
        () => child,
        () => next,
        () => previous,
        () => nextNext,
      ),
    );
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

function findPreviousSpacingComponentInList(components: Component[], index: number): Component | undefined {
  for (let i = index - 1; i >= 0; i--) {
    const child = components[i];
    if (child && getChatSpacingKind(child)) return child;
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
  let currentCompactRun: CompactToolGroupingParticipant[] = [];

  const flushCompactRunColor = () => {
    const color = getCompactRunLabelColor(currentCompactRun);
    for (const participant of currentCompactRun) {
      participant.setCompactToolGroupLabelColor?.(color);
    }
    currentCompactRun = [];
  };

  for (let i = 0; i < components.length; i++) {
    const component = components[i]!;
    const participant = component as CompactToolGroupingParticipant;
    const compactToolGroupKey = participant.getCompactToolGroupKey?.();
    const compactToolGroupSummary = participant.getCompactToolGroupSummary?.();
    const next = findNextSpacingComponentInList(components, i);
    const nextParticipant = next as CompactToolGroupingParticipant | undefined;
    const nextCompactToolGroupKey = nextParticipant?.getCompactToolGroupKey?.();
    const isContinuation = !!compactToolGroupKey && compactToolGroupKey === previousCompactToolGroupKey;
    participant.setCompactToolContinuation?.(isContinuation, isContinuation ? previousCompactToolSummary : undefined);
    participant.setCompactToolHasFollowingContinuation?.(
      !!compactToolGroupKey && compactToolGroupKey === nextCompactToolGroupKey,
    );
    if (compactToolGroupKey) {
      if (!isContinuation) flushCompactRunColor();
      currentCompactRun.push(participant);
    } else {
      flushCompactRunColor();
      participant.setCompactToolGroupLabelColor?.(undefined);
    }
    if (getChatSpacingKind(component)) {
      previousCompactToolGroupKey = compactToolGroupKey;
      previousCompactToolSummary = compactToolGroupSummary;
    }

    nextChildren.push(component);

    if (getChatSpacingKind(component)) {
      const previous = findPreviousSpacingComponentInList(components, i);
      const nextIndex = next ? components.indexOf(next) : -1;
      const nextNext = nextIndex >= 0 ? findNextSpacingComponentInList(components, nextIndex) : undefined;
      if (next) {
        nextChildren.push(
          new ChatBoundarySpacer(
            () => component,
            () => next,
            () => previous,
            () => nextNext,
          ),
        );
      }
    }
  }

  flushCompactRunColor();
  chatContainer.children = nextChildren as never[];
  chatContainer.invalidate();
}

function getCompactRunLabelColor(participants: CompactToolGroupingParticipant[]): CompactToolLabelColor | undefined {
  if (participants.length <= 1) return undefined;
  if (participants.some(participant => participant.getOwnCompactToolLabelColor?.() === 'error')) return 'error';
  return 'toolTitle';
}
