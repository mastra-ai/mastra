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
    messageComponentsById: new Map(),
    allShellComponents: [],
    pendingSubagents: new Map(),
    pendingAskUserComponents: new Map(),
    pendingSubmitPlanComponents: new Map(),
    pendingSignalMessageComponentsById: new Map(),
  } as unknown as TUIState;
}

describe('pruneChatContainer', () => {
  it('keeps the last 3000 children and removes every reference to pruned components', () => {
    const state = createState(5001);

    const removedTool = { toolName: 'removed-tool' };
    const keptTool = { toolName: 'kept-tool' };
    const removedSlash = new SlashCommandComponent('removed', 'echo removed');
    const keptSlash = new SlashCommandComponent('kept', 'echo kept');
    const removedReminder = new SystemReminderComponent({ message: 'Removed body' });
    const keptReminder = new SystemReminderComponent({ message: 'Kept body' });
    const removedShell = { id: 'removed-shell' };
    const keptShell = { id: 'kept-shell' };
    const removedMessage = new Text('removed-message', 0, 0);
    const keptMessage = new Text('kept-message', 0, 0);
    const removedSubagent = new Text('removed-subagent', 0, 0);
    const removedAskUser = new Text('removed-ask-user', 0, 0);
    const removedSubmitPlan = new Text('removed-submit-plan', 0, 0);

    state.chatContainer.children[10] = removedTool as any;
    state.chatContainer.children[20] = removedSlash as any;
    state.chatContainer.children[30] = removedReminder as any;
    state.chatContainer.children[40] = removedShell as any;
    state.chatContainer.children[50] = removedMessage;
    state.chatContainer.children[60] = removedSubagent;
    state.chatContainer.children[70] = removedAskUser;
    state.chatContainer.children[80] = removedSubmitPlan;
    state.chatContainer.children[3500] = keptTool as any;
    state.chatContainer.children[3700] = keptSlash as any;
    state.chatContainer.children[3800] = keptReminder as any;
    state.chatContainer.children[3900] = keptShell as any;
    state.chatContainer.children[5000] = keptMessage;

    state.allToolComponents = [removedTool as any, keptTool as any];
    state.allSlashCommandComponents = [removedSlash, keptSlash];
    state.allSystemReminderComponents = [removedReminder, keptReminder];
    state.allShellComponents = [removedShell as any, keptShell as any];
    state.messageComponentsById.set('removed', removedMessage);
    state.messageComponentsById.set('kept', keptMessage);
    state.pendingSubagents.set('removed', removedSubagent as any);
    state.pendingAskUserComponents.set('removed', removedAskUser as any);
    state.pendingSubmitPlanComponents.set('removed', removedSubmitPlan as any);

    pruneChatContainer(state);

    expect(state.chatContainer.children).toHaveLength(3000);
    expect(state.chatContainer.children[1499]).toBe(keptTool);
    expect(state.chatContainer.children[1699]).toBe(keptSlash);
    expect(state.chatContainer.children[1799]).toBe(keptReminder);
    expect(state.chatContainer.children[1899]).toBe(keptShell);
    expect(state.chatContainer.children[2999]).toBe(keptMessage);
    expect(state.allToolComponents).toEqual([keptTool]);
    expect(state.allSlashCommandComponents).toEqual([keptSlash]);
    expect(state.allSystemReminderComponents).toEqual([keptReminder]);
    expect(state.allShellComponents).toEqual([keptShell]);
    expect(state.messageComponentsById).toEqual(new Map([['kept', keptMessage]]));
    expect(state.pendingSubagents).toEqual(new Map());
    expect(state.pendingAskUserComponents).toEqual(new Map());
    expect(state.pendingSubmitPlanComponents).toEqual(new Map());
  });

  it('does nothing when the container is already within the limit', () => {
    const state = createState(5000);
    const originalChildren = [...state.chatContainer.children];

    pruneChatContainer(state);

    expect(state.chatContainer.children).toHaveLength(5000);
    expect(state.chatContainer.children).toEqual(originalChildren);
  });
});
