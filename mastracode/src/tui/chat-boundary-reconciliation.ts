import type { Component, Container } from '@earendil-works/pi-tui';
import { ChatBoundarySpacer, isChatBoundarySpacer } from './components/chat-boundary-spacer.js';
import { getChatSpacingKind, getSpacingBetweenComponents } from './components/chat-spacing.js';
import type { CompactToolLabelColor } from './components/tool-execution-interface.js';

interface CompactToolGroupingParticipant {
  getCompactToolGroupKey?(): string | undefined;
  getCompactToolGroupSummary?(): string | undefined;
  getOwnCompactToolLabelColor?(): CompactToolLabelColor | undefined;
  setCompactToolGroupLabelColor?(color: CompactToolLabelColor | undefined): void;
  setCompactToolContinuation?(continuation: boolean, previousSummary?: string): void;
  setCompactToolHasFollowingContinuation?(hasFollowingContinuation: boolean): void;
}

/**
 * Insert a chat component into the container and reconcile spacing.
 *
 * The component is spliced at `index` and then a single reconciliation
 * pass places static spacers above each component that needs one.
 */
export function insertChatComponentWithBoundarySpacing(
  chatContainer: Container,
  child: Component,
  index = chatContainer.children.length,
): void {
  const children = chatContainer.children as Component[];
  const boundedIndex = Math.max(0, Math.min(index, children.length));
  children.splice(boundedIndex, 0, child);
  reconcileChatBoundarySpacers(chatContainer);
}

/**
 * Rebuild the spacing layout for a chat container.
 *
 * Places one static {@link ChatBoundarySpacer} above each component that
 * participates in spacing (has a `getChatSpacingKind`) and has a preceding
 * spacing participant.  Spacer heights are computed once via
 * `getSpacingBetweenComponents` — no per-frame recomputation.
 *
 * Existing spacer instances are reused (via `setLines`) to minimise
 * object churn and avoid identity-change flicker.
 */
export function reconcileChatBoundarySpacers(chatContainer: Container): void {
  const children = chatContainer.children as Component[];
  const components = children.filter(child => !isChatBoundarySpacer(child));

  // Pool existing spacers for reuse so we keep the same object identity
  // where possible, reducing object churn.
  const spacerPool = children.filter(isChatBoundarySpacer);
  let poolIndex = 0;

  const nextCompactToolGroupKeys = new Array<string | undefined>(components.length);
  let nextSpacingComponentGroupKey: string | undefined;
  for (let i = components.length - 1; i >= 0; i--) {
    nextCompactToolGroupKeys[i] = nextSpacingComponentGroupKey;
    const component = components[i];
    if (component && getChatSpacingKind(component)) {
      nextSpacingComponentGroupKey = (component as CompactToolGroupingParticipant).getCompactToolGroupKey?.();
    }
  }

  const nextChildren: Component[] = [];
  let previousCompactToolGroupKey: string | undefined;
  let previousCompactToolSummary: string | undefined;
  let currentCompactRun: CompactToolGroupingParticipant[] = [];
  let previousSpacingComponent: Component | undefined;

  const flushCompactRunColor = () => {
    const color = getCompactRunLabelColor(currentCompactRun);
    for (const participant of currentCompactRun) {
      participant.setCompactToolGroupLabelColor?.(color);
    }
    currentCompactRun = [];
  };

  for (let i = 0; i < components.length; i++) {
    const component = components[i]!;

    // --- compact-tool grouping (unchanged logic) --------------------------
    const participant = component as CompactToolGroupingParticipant;
    const compactToolGroupKey = participant.getCompactToolGroupKey?.();
    const compactToolGroupSummary = participant.getCompactToolGroupSummary?.();
    const nextCompactToolGroupKey = nextCompactToolGroupKeys[i];
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

    // --- spacer above this component --------------------------------------
    if (getChatSpacingKind(component) && previousSpacingComponent) {
      const spacing = getSpacingBetweenComponents(previousSpacingComponent, component);
      if (spacing > 0) {
        let spacer: ChatBoundarySpacer;
        if (poolIndex < spacerPool.length) {
          spacer = spacerPool[poolIndex]!;
          spacer.setLines(spacing);
          poolIndex++;
        } else {
          spacer = new ChatBoundarySpacer(spacing);
        }
        nextChildren.push(spacer);
      }
    }

    if (getChatSpacingKind(component)) {
      previousSpacingComponent = component;
    }

    nextChildren.push(component);
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
