import type { Component } from '@earendil-works/pi-tui';

import { reconcileChatBoundarySpacers } from './chat-boundary-reconciliation.js';
import { isChatBoundarySpacer } from './components/chat-boundary-spacer.js';
import type { TUIState } from './state.js';

const MAX_CHILDREN = 500;
const KEEP_CHILDREN = 250;

function deleteRemovedMapValues<K, V>(
  map: Map<K, V>,
  removed: ReadonlySet<Component>,
  getComponent: (value: V) => Component = value => value as Component,
): void {
  for (const [key, value] of map) {
    if (removed.has(getComponent(value))) map.delete(key);
  }
}

function clearRemovedReference<K extends keyof TUIState>(
  state: TUIState,
  key: K,
  removed: ReadonlySet<Component>,
): void {
  if (removed.has(state[key] as Component)) state[key] = undefined as TUIState[K];
}

function disposeRemovedComponentReferences(state: TUIState, removed: ReadonlySet<Component>): void {
  state.assistantRenderRegistry.disposeComponents(removed);

  deleteRemovedMapValues(state.messageComponentsById, removed);
  deleteRemovedMapValues(state.pendingTools, removed);
  deleteRemovedMapValues(state.pendingSubagents, removed);
  deleteRemovedMapValues(state.pendingAskUserComponents, removed);
  deleteRemovedMapValues(state.pendingSubmitPlanComponents, removed);
  deleteRemovedMapValues(state.pendingSignalMessageComponentsById, removed, pending => pending.component);

  state.allToolComponents = state.allToolComponents.filter(
    component => !removed.has(component as unknown as Component),
  );
  state.allSlashCommandComponents = state.allSlashCommandComponents.filter(component => !removed.has(component));
  state.allSystemReminderComponents = state.allSystemReminderComponents.filter(component => !removed.has(component));
  state.allShellComponents = state.allShellComponents.filter(component => !removed.has(component));
  state.followUpComponents = state.followUpComponents.filter(component => !removed.has(component));

  clearRemovedReference(state, 'streamingComponent', removed);
  if (!state.streamingComponent) state.streamingMessage = undefined;
  clearRemovedReference(state, 'lastAskUserComponent', removed);
  clearRemovedReference(state, 'activeInlineQuestion', removed);
  clearRemovedReference(state, 'activeInlinePlanApproval', removed);
  clearRemovedReference(state, 'pendingFocus', removed);
  clearRemovedReference(state, 'activeOnboarding', removed);
  clearRemovedReference(state, 'lastSubmitPlanComponent', removed);
  clearRemovedReference(state, 'omProgressComponent', removed);
  clearRemovedReference(state, 'activeOMMarker', removed);
  clearRemovedReference(state, 'activeBufferingMarker', removed);
  clearRemovedReference(state, 'activeActivationMarker', removed);
  clearRemovedReference(state, 'activeActivationProviderChangeMarker', removed);
  clearRemovedReference(state, 'taskProgress', removed);

  if (state.activeGoalJudge && removed.has(state.activeGoalJudge.component)) state.activeGoalJudge = undefined;
}

export function pruneChatContainer(state: TUIState): void {
  const children = state.chatContainer.children as Component[];
  if (children.length <= MAX_CHILDREN) return;

  const previousChildren = [...children];
  let firstRetainedIndex = children.length - KEEP_CHILDREN;
  while (firstRetainedIndex < children.length && isChatBoundarySpacer(children[firstRetainedIndex])) {
    firstRetainedIndex++;
  }

  children.splice(0, firstRetainedIndex);
  reconcileChatBoundarySpacers(state.chatContainer);

  const retained = new Set(state.chatContainer.children as Component[]);
  const removed = new Set(previousChildren.filter(component => !retained.has(component)));
  disposeRemovedComponentReferences(state, removed);
}
