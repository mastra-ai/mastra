import { Container } from '@mariozechner/pi-tui';
import type { HarnessMessage } from '@mastra/core/harness';
import { describe, expect, it, vi } from 'vitest';

import { SystemReminderComponent } from '../components/system-reminder.js';
import { UserMessageComponent } from '../components/user-message.js';
import { addUserMessage } from '../render-messages.js';
import type { TUIState } from '../state.js';

function createState(): TUIState {
  return {
    chatContainer: new Container(),
    ui: { requestRender: vi.fn() },
    toolOutputExpanded: false,
    allSystemReminderComponents: [],
    allSlashCommandComponents: [],
    allToolComponents: [],
    allShellComponents: [],
    messageComponentsById: new Map(),
    followUpComponents: [],
    harness: {
      getDisplayState: () => ({ isRunning: false }),
    },
  } as unknown as TUIState;
}

function createUserMessage(text: string, id = 'user-1'): HarnessMessage {
  return {
    id,
    role: 'user',
    content: [{ type: 'text', text }],
  } as HarnessMessage;
}

describe('addUserMessage', () => {
  it('renders a persisted temporal-gap marker only when the whole message is a system-reminder tag', () => {
    const state = createState();

    addUserMessage(
      state,
      createUserMessage('<system-reminder type="temporal-gap">15 minutes later</system-reminder>', '__temporal_1'),
    );

    expect(state.chatContainer.children).toHaveLength(1);
    expect(state.chatContainer.children[0]).toBeInstanceOf(SystemReminderComponent);
    expect(state.messageComponentsById.size).toBe(0);
  });

  it('anchors a persisted temporal-gap marker before its target message when precedesMessageId is present', () => {
    const state = createState();

    addUserMessage(state, createUserMessage('Real user message', 'user-1'));
    addUserMessage(
      state,
      createUserMessage(
        '<system-reminder type="temporal-gap" precedesMessageId="user-1">15 minutes later</system-reminder>',
        '__temporal_1',
      ),
    );

    expect(state.chatContainer.children).toHaveLength(2);
    expect(state.chatContainer.children[0]).toBeInstanceOf(SystemReminderComponent);
    expect(state.chatContainer.children[1]).toBeInstanceOf(UserMessageComponent);
    expect(state.messageComponentsById.get('user-1')).toBe(state.chatContainer.children[1]);
  });

  it('keeps normal user text visible when it merely quotes a system-reminder tag', () => {
    const state = createState();

    addUserMessage(
      state,
      createUserMessage(
        'ok with latest changes it still shows in the wrong order <system-reminder type="temporal-gap">15 minutes later</system-reminder> anyway it is not working',
      ),
    );

    expect(state.chatContainer.children).toHaveLength(1);
    expect(state.chatContainer.children[0]).toBeInstanceOf(UserMessageComponent);
    expect(state.allSystemReminderComponents).toHaveLength(0);
    expect(state.messageComponentsById.get('user-1')).toBe(state.chatContainer.children[0]);
  });
});
