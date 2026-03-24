import { Container } from '@mariozechner/pi-tui';
import type { HarnessMessage } from '@mastra/core/harness';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SystemReminderComponent } from '../../components/system-reminder.js';
import { handleMessageUpdate } from '../message.js';
import type { EventHandlerContext } from '../types.js';
import type { TUIState } from '../../state.js';

function createAssistantMessage(content: HarnessMessage['content']): HarnessMessage {
  return {
    id: 'msg-1',
    role: 'assistant',
    content,
  } as HarnessMessage;
}

describe('handleMessageUpdate system reminders', () => {
  let state: TUIState;
  let ctx: EventHandlerContext;

  beforeEach(() => {
    const chatContainer = new Container();
    state = {
      chatContainer,
      followUpComponents: [],
      ui: { requestRender: vi.fn() },
      seenSystemReminderKeys: new Set(),
      pendingTools: new Map(),
      seenToolCallIds: new Set(),
      subagentToolCallIds: new Set(),
      allToolComponents: [],
      allSlashCommandComponents: [],
      allSystemReminderComponents: [],
      pendingSubagents: new Map(),
      hideThinkingBlock: false,
      toolOutputExpanded: false,
    } as unknown as TUIState;

    ctx = {
      state,
      addChildBeforeFollowUps: (child: any) => {
        state.chatContainer.addChild(child);
      },
    } as EventHandlerContext;
  });

  it('renders a streamed placeholder when reminder content is not available yet', () => {
    handleMessageUpdate(
      ctx,
      createAssistantMessage([
        {
          type: 'system_reminder',
          reminderType: 'dynamic-agents-md',
          path: '/repo/src/agents/nested/AGENTS.md',
        } as never,
      ]),
    );

    expect(state.chatContainer.children).toHaveLength(1);
    expect(state.allSystemReminderComponents).toHaveLength(1);
    const component = state.chatContainer.children[0];
    expect(component).toBeInstanceOf(SystemReminderComponent);
    expect(state.allSystemReminderComponents[0]).toBe(component);

    const rendered = (component as SystemReminderComponent)
      .render(80)
      .join('\n');

    expect(rendered).toContain('Loaded AGENTS.md');
    expect(rendered).toContain('Loading instruction file contents');
  });

  it('deduplicates repeated streamed reminders with the same path and type', () => {
    const message = createAssistantMessage([
      {
        type: 'system_reminder',
        reminderType: 'dynamic-agents-md',
        path: '/repo/src/agents/nested/AGENTS.md',
      } as never,
    ]);

    handleMessageUpdate(ctx, message);
    handleMessageUpdate(ctx, message);

    expect(state.chatContainer.children).toHaveLength(1);
  });
});
