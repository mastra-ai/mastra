import { Spacer } from '@mariozechner/pi-tui';
import type { Component } from '@mariozechner/pi-tui';

import type { TUIState } from './state.js';

const MAX_CHILDREN = 200;
const KEEP_CHILDREN = 100;

function isSpacer(component: Component | undefined): component is Spacer {
  return component instanceof Spacer;
}

function isEntryStart(children: Component[], index: number): boolean {
  return isSpacer(children[index]) && !isSpacer(children[index + 1]);
}

function findSpliceStart(children: Component[]): number {
  let entriesKept = 0;

  for (let i = children.length - 1; i >= 0; i--) {
    if (!isEntryStart(children, i)) {
      continue;
    }

    entriesKept += 1;
    if (entriesKept > KEEP_CHILDREN) {
      return i + 1;
    }
  }

  return 0;
}

export function pruneChatContainer(state: TUIState): void {
  const children = state.chatContainer.children as Component[];
  if (children.length <= MAX_CHILDREN) {
    return;
  }

  const spliceStart = findSpliceStart(children);
  if (spliceStart <= 0) {
    return;
  }

  const removed = new Set(children.slice(0, spliceStart));
  children.splice(0, spliceStart);
  state.chatContainer.invalidate();

  state.allToolComponents = state.allToolComponents.filter(
    component => !removed.has(component as unknown as Component),
  );
  state.allSlashCommandComponents = state.allSlashCommandComponents.filter(component => !removed.has(component));
  state.allSystemReminderComponents = state.allSystemReminderComponents.filter(component => !removed.has(component));
}
