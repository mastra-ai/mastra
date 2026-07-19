import { Container, Text } from '@earendil-works/pi-tui';
import { describe, expect, it } from 'vitest';

import { SlashCommandComponent } from '../components/slash-command.js';
import { SystemReminderComponent } from '../components/system-reminder.js';
import { pruneChatContainer } from '../prune-chat.js';
import type { TUIState } from '../state.js';

function createState(childrenCount: number): TUIState {
  const chatContainer = new Container();

  for (let i = 0; i < childrenCount; i++) {
    chatContainer.addChild(new Text(`child-${i}`, 0, 0));
  }

  return {
    chatContainer,
    allToolComponents: [],
    allSlashCommandComponents: [],
    allSystemReminderComponents: [],
    allShellComponents: [],
    pendingSignalMessageComponentsById: new Map(),
  } as unknown as TUIState;
}

describe('pruneChatContainer', () => {
  it('keeps the last 3000 children and removes tracked components that were pruned', () => {
    const state = createState(6000);

    const removedTool = { toolName: 'removed-tool' };
    const keptTool = { toolName: 'kept-tool' };
    const removedSlash = new SlashCommandComponent('removed', 'echo removed');
    const keptSlash = new SlashCommandComponent('kept', 'echo kept');
    const removedReminder = new SystemReminderComponent({ message: 'Removed body' });
    const keptReminder = new SystemReminderComponent({ message: 'Kept body' });
    const removedShell = { id: 'removed-shell' };
    const keptShell = { id: 'kept-shell' };

    state.chatContainer.children[10] = removedTool as any;
    state.chatContainer.children[20] = removedSlash as any;
    state.chatContainer.children[30] = removedReminder as any;
    state.chatContainer.children[40] = removedShell as any;
    state.chatContainer.children[5500] = keptTool as any;
    state.chatContainer.children[5700] = keptSlash as any;
    state.chatContainer.children[5800] = keptReminder as any;
    state.chatContainer.children[5900] = keptShell as any;

    state.allToolComponents = [removedTool as any, keptTool as any];
    state.allSlashCommandComponents = [removedSlash, keptSlash];
    state.allSystemReminderComponents = [removedReminder, keptReminder];
    state.allShellComponents = [removedShell as any, keptShell as any];

    pruneChatContainer(state);

    expect(state.chatContainer.children).toHaveLength(3000);
    expect(state.chatContainer.children[2500]).toBe(keptTool);
    expect(state.chatContainer.children[2700]).toBe(keptSlash);
    expect(state.chatContainer.children[2800]).toBe(keptReminder);
    expect(state.chatContainer.children[2900]).toBe(keptShell);
    expect(state.allToolComponents).toEqual([keptTool]);
    expect(state.allSlashCommandComponents).toEqual([keptSlash]);
    expect(state.allSystemReminderComponents).toEqual([keptReminder]);
    expect(state.allShellComponents).toEqual([keptShell]);
  });

  it('does nothing when the container is already within the limit', () => {
    const state = createState(5000);
    const originalChildren = [...state.chatContainer.children];

    pruneChatContainer(state);

    expect(state.chatContainer.children).toHaveLength(5000);
    expect(state.chatContainer.children).toEqual(originalChildren);
  });
});
