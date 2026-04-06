import { Container, Spacer, Text } from '@mariozechner/pi-tui';
import { describe, expect, it } from 'vitest';

import { SlashCommandComponent } from '../components/slash-command.js';
import { SystemReminderComponent } from '../components/system-reminder.js';
import { pruneChatContainer } from '../prune-chat.js';
import type { TUIState } from '../state.js';

function createState(): TUIState {
  return {
    chatContainer: new Container(),
    allToolComponents: [],
    allSlashCommandComponents: [],
    allSystemReminderComponents: [],
  } as unknown as TUIState;
}

function addEntry(chatContainer: Container, component: Text | SlashCommandComponent | SystemReminderComponent) {
  chatContainer.addChild(new Spacer(1));
  chatContainer.addChild(component);
  chatContainer.addChild(new Spacer(1));
}

describe('pruneChatContainer', () => {
  it('keeps recent whole entries and removes tracked components that were pruned', () => {
    const state = createState();

    const removedTool = new Text('removed-tool', 0, 0);
    const keptTool = new Text('kept-tool', 0, 0);
    const removedSlash = new SlashCommandComponent('removed', 'echo removed');
    const keptSlash = new SlashCommandComponent('kept', 'echo kept');
    const removedReminder = new SystemReminderComponent({ message: 'Removed body' });
    const keptReminder = new SystemReminderComponent({ message: 'Kept body' });

    for (let i = 0; i < 20; i++) {
      addEntry(state.chatContainer, new Text(`child-${i}`, 0, 0));
    }

    addEntry(state.chatContainer, removedTool);
    addEntry(state.chatContainer, removedSlash);
    addEntry(state.chatContainer, removedReminder);

    for (let i = 20; i < 210; i++) {
      addEntry(state.chatContainer, new Text(`child-${i}`, 0, 0));
    }

    addEntry(state.chatContainer, keptTool);
    addEntry(state.chatContainer, keptSlash);
    addEntry(state.chatContainer, keptReminder);

    state.allToolComponents = [removedTool as any, keptTool as any];
    state.allSlashCommandComponents = [removedSlash, keptSlash];
    state.allSystemReminderComponents = [removedReminder, keptReminder];

    pruneChatContainer(state);

    expect(state.chatContainer.children.length).toBeLessThan(400);
    expect(state.chatContainer.children).toContain(keptTool);
    expect(state.chatContainer.children).toContain(keptSlash);
    expect(state.chatContainer.children).toContain(keptReminder);
    expect(state.chatContainer.children).not.toContain(removedTool);
    expect(state.chatContainer.children).not.toContain(removedSlash);
    expect(state.chatContainer.children).not.toContain(removedReminder);
    expect(state.allToolComponents).toEqual([keptTool as any]);
    expect(state.allSlashCommandComponents).toEqual([keptSlash]);
    expect(state.allSystemReminderComponents).toEqual([keptReminder]);
  });

  it('does nothing when the container is already within the limit', () => {
    const state = createState();
    for (let i = 0; i < 66; i++) {
      addEntry(state.chatContainer, new Text(`child-${i}`, 0, 0));
    }
    const originalChildren = [...state.chatContainer.children];

    pruneChatContainer(state);

    expect(state.chatContainer.children).toHaveLength(originalChildren.length);
    expect(state.chatContainer.children).toEqual(originalChildren);
  });
});
