import type { Component } from '@mariozechner/pi-tui';

import type { TUIState } from './state.js';

const MAX_CHILDREN = 200;
const KEEP_CHILDREN = 100;

export function pruneChatContainer(state: TUIState): void {
  const children = state.chatContainer.children as Component[];
  if (children.length <= MAX_CHILDREN) {
    return;
  }

  const removeCount = children.length - KEEP_CHILDREN;
  const removed = new Set(children.slice(0, removeCount));

  children.splice(0, removeCount);
  state.chatContainer.invalidate();

  state.allToolComponents = state.allToolComponents.filter(
    component => !removed.has(component as unknown as Component),
  );
  state.allSlashCommandComponents = state.allSlashCommandComponents.filter(component => !removed.has(component));
  state.allSystemReminderComponents = state.allSystemReminderComponents.filter(component => !removed.has(component));
  state.allShellComponents = state.allShellComponents.filter(
    component => !removed.has(component as unknown as Component),
  );
}
