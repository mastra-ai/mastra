import type { Component, Container } from '@earendil-works/pi-tui';
import { ChatBoundarySpacer, isChatBoundarySpacer } from './components/chat-boundary-spacer.js';
import { PENDING_SHELL_GROUP_KEY, getChatSpacingKind, getSpacingBetweenComponents } from './components/chat-spacing.js';
import type { CompactToolLabelColor } from './components/tool-execution-interface.js';

interface CompactToolGroupingParticipant {
  getCompactToolGroupKey?(): string | undefined;
  getCompactToolGroupSummary?(): string | undefined;
  getOwnCompactToolLabelColor?(): CompactToolLabelColor | undefined;
  setCompactToolGroupLabelColor?(color: CompactToolLabelColor | undefined): void;
  setCompactToolContinuation?(continuation: boolean, previousSummary?: string): void;
  setCompactToolHasFollowingContinuation?(hasFollowingContinuation: boolean): void;
  getQuietShellNaturalWidth?(): number | undefined;
  setQuietShellGroupWidth?(width: number | undefined): void;
  getQuietShellPreviewLines?(): string[] | undefined;
  setQuietShellGroupPreview?(lines: string[] | undefined): void;
  setQuietShellHeld?(held: boolean): void;
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

  // A shell call still streaming its directory stays hidden below a shell box until it knows which
  // box it belongs in. With no shell box above, it opens its own and fills in the directory later.
  const compactToolGroupKeys = new Array<string | undefined>(components.length);
  let previousSpacingGroupKey: string | undefined;
  for (let i = 0; i < components.length; i++) {
    const component = components[i]!;
    const participant = component as CompactToolGroupingParticipant;
    let key = participant.getCompactToolGroupKey?.();
    const held = key === PENDING_SHELL_GROUP_KEY && !!previousSpacingGroupKey?.startsWith('$ ');
    participant.setQuietShellHeld?.(held);
    if (held) key = undefined;
    compactToolGroupKeys[i] = key;
    if (getChatSpacingKind(component)) previousSpacingGroupKey = key;
  }

  const nextCompactToolGroupKeys = new Array<string | undefined>(components.length);
  let nextSpacingComponentGroupKey: string | undefined;
  for (let i = components.length - 1; i >= 0; i--) {
    nextCompactToolGroupKeys[i] = nextSpacingComponentGroupKey;
    const component = components[i];
    if (component && getChatSpacingKind(component)) {
      nextSpacingComponentGroupKey = compactToolGroupKeys[i];
    }
  }

  const nextChildren: Component[] = [];
  let previousCompactToolGroupKey: string | undefined;
  let previousCompactToolSummary: string | undefined;
  let currentCompactRun: CompactToolGroupingParticipant[] = [];
  let previousSpacingComponent: Component | undefined;

  const flushCompactRun = () => {
    const color = getCompactRunLabelColor(currentCompactRun);
    // Calls sharing a quiet shell box must agree on its width: the widest row wins.
    const widths = currentCompactRun
      .map(participant => participant.getQuietShellNaturalWidth?.())
      .filter((width): width is number => width !== undefined);
    const groupWidth = widths.length > 0 ? Math.max(...widths) : undefined;
    // The box's first call draws its preview: the latest output of any call in the box.
    const previews = currentCompactRun.map(participant => participant.getQuietShellPreviewLines?.());
    const preview = previews.findLast(lines => lines && lines.length > 0) ?? previews.find(lines => lines);
    currentCompactRun.forEach((participant, index) => {
      participant.setCompactToolGroupLabelColor?.(color);
      participant.setQuietShellGroupWidth?.(groupWidth);
      participant.setQuietShellGroupPreview?.(index === 0 ? preview : undefined);
    });
    currentCompactRun = [];
  };

  for (let i = 0; i < components.length; i++) {
    const component = components[i]!;

    // --- compact-tool grouping --------------------------------------------
    const participant = component as CompactToolGroupingParticipant;
    const compactToolGroupKey = compactToolGroupKeys[i];
    const compactToolGroupSummary = participant.getCompactToolGroupSummary?.();
    const nextCompactToolGroupKey = nextCompactToolGroupKeys[i];
    const isContinuation = !!compactToolGroupKey && compactToolGroupKey === previousCompactToolGroupKey;
    participant.setCompactToolContinuation?.(isContinuation, isContinuation ? previousCompactToolSummary : undefined);
    participant.setCompactToolHasFollowingContinuation?.(
      !!compactToolGroupKey && compactToolGroupKey === nextCompactToolGroupKey,
    );
    if (compactToolGroupKey) {
      if (!isContinuation) flushCompactRun();
      currentCompactRun.push(participant);
    } else {
      // Entries that take no space (e.g. a quiet assistant message with only hidden thinking)
      // don't break a run, matching the continuation check above.
      if (getChatSpacingKind(component)) flushCompactRun();
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

  flushCompactRun();

  const childrenChanged =
    children.length !== nextChildren.length || children.some((child, index) => child !== nextChildren[index]);
  if (childrenChanged) {
    // Container has no render cache; recursively invalidating here would discard
    // every completed child's Text/Markdown cache on each streamed update.
    chatContainer.children = nextChildren as never[];
  }
}

function getCompactRunLabelColor(participants: CompactToolGroupingParticipant[]): CompactToolLabelColor | undefined {
  if (participants.length <= 1) return undefined;
  if (participants.some(participant => participant.getOwnCompactToolLabelColor?.() === 'error')) return 'error';
  return 'toolTitle';
}
